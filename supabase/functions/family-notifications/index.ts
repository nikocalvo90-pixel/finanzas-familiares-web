import { eligibleTargets, stillEligible } from "./routing.mjs";
import * as webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const ADMIN_KEY = SECRET_KEYS.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const baseHeaders = {
  "apikey": ADMIN_KEY,
  "Content-Type": "application/json"
};

async function rpc(name: string, body: Record<string, unknown> = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify(body)
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error(`RPC ${name}: ${r.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

async function getRows(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: baseHeaders });
  const text = await r.text();
  const data = text ? JSON.parse(text) : [];
  if (!r.ok) throw new Error(`GET ${path}: ${r.status} ${JSON.stringify(data)}`);
  return data;
}

async function patchRows(path: string, body: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...baseHeaders, "Prefer": "return=minimal" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`PATCH ${path}: ${r.status} ${await r.text()}`);
}

function madridDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const o: Record<string,string> = {};
  for (const p of parts) if (p.type !== "literal") o[p.type] = p.value;
  return `${o.year}-${o.month}-${o.day}`;
}

async function runtimeSecrets() {
  return await rpc("notification_runtime_secrets");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  try {
    let runtime = await runtimeSecrets();

    if (!runtime?.vapid_private || !runtime?.vapid_public || !runtime?.cron_token) {
      // Initialization is an administrative action, never an unauthenticated request.
      return Response.json({ error: "Avisos pendientes de configuración." }, { status: 503 });
    }

    const supplied = req.headers.get("x-cron-token") || "";
    if (supplied !== runtime.cron_token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    webpush.setVapidDetails(
      "https://casuo.es/",
      runtime.vapid_public,
      runtime.vapid_private
    );

    const day = madridDate();
    const created = await rpc("refresh_all_notifications", { p_day: day });

    const [prefs, events, subs] = await Promise.all([
      getRows("notification_preferences?push_enabled=eq.true&select=household_id,user_id,push_enabled"),
      getRows("notification_events?sent_at=is.null&dismissed_at=is.null&order=created_at.asc&limit=200&select=id,household_id,user_id,title,body,target_hash,kind,source_key,attempt_count"),
      getRows("push_subscriptions?disabled_at=is.null&select=id,household_id,user_id,endpoint,p256dh,auth_key")
    ]);

    let sent = 0, failed = 0, disabled = 0;
    for (const event of (events || [])) {
      const userSubs = eligibleTargets(event, prefs || [], subs || []);
      if (!userSubs.length) continue;

      let successes = 0;
      let lastError = "";
      for (const sub of userSubs) {
        try {
          // Recheck before EACH device: queued events may outlive a membership.
          if (!await stillEligible(event, sub, getRows)) continue;
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
            JSON.stringify({
              title: event.title,
              body: event.body,
              url: event.target_hash || "#inicio",
              eventId: event.id,
              tag: event.source_key
            }),
            { TTL: 43200, urgency: "normal" }
          );
          successes++;
        } catch (e: any) {
          const status = Number(e?.statusCode || e?.status || 0);
          lastError = String(e?.message || e).slice(0, 500);
          if (status === 404 || status === 410) {
            await patchRows(`push_subscriptions?id=eq.${encodeURIComponent(sub.id)}`, { disabled_at: new Date().toISOString() });
            disabled++;
          }
        }
      }

      if (successes > 0) {
        await patchRows(`notification_events?id=eq.${encodeURIComponent(event.id)}`, {
          sent_at: new Date().toISOString(),
          attempt_count: Number(event.attempt_count || 0) + 1,
          push_last_error: null
        });
        sent++;
      } else {
        await patchRows(`notification_events?id=eq.${encodeURIComponent(event.id)}`, {
          attempt_count: Number(event.attempt_count || 0) + 1,
          push_last_error: lastError || "No active subscription"
        });
        failed++;
      }
    }

    return Response.json({ ok: true, day, created, sent, failed, disabled });
  } catch (error: any) {
    console.error("Notification delivery failed");
    return Response.json({ error: "No se han podido procesar los avisos." }, { status: 500 });
  }
});
