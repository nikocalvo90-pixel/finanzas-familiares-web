// A device and an opt-in belong to one household, even for multi-household users.
const same = (a,b) => !!a?.household_id && !!a?.user_id && a.household_id===b?.household_id && a.user_id===b?.user_id;
export function eligibleTargets(event, prefs, subscriptions){
 if(!prefs.some(p=>same(p,event)&&p.push_enabled===true))return [];
 return subscriptions.filter(s=>same(s,event)&&s.disabled_at==null);
}
export async function stillEligible(event, sub, getRows){
 if(!same(event,sub)||!event.id||!sub.id)return false;
 const scope='household_id=eq.'+encodeURIComponent(event.household_id)+'&user_id=eq.'+encodeURIComponent(event.user_id);
 // Check the event, consent and device again, not just the initial cron snapshot.
 const [events,prefs,subs]=await Promise.all([
  getRows('notification_events?'+scope+'&id=eq.'+encodeURIComponent(event.id)+'&sent_at=is.null&dismissed_at=is.null&select=id,household_id,user_id&limit=1'),
  getRows('notification_preferences?'+scope+'&push_enabled=eq.true&select=household_id,user_id,push_enabled&limit=1'),
  getRows('push_subscriptions?'+scope+'&id=eq.'+encodeURIComponent(sub.id)+'&disabled_at=is.null&select=id,household_id,user_id,endpoint,p256dh,auth_key&limit=1')
 ]);
 if(!events.some(e=>e.id===event.id&&same(e,event))||!eligibleTargets(event,prefs,subs).some(s=>s.id===sub.id&&s.endpoint===sub.endpoint&&s.p256dh===sub.p256dh&&s.auth_key===sub.auth_key))return false;
 const members=await getRows('household_members?'+scope+'&select=household_id,user_id&limit=1');
 return members.some(m=>same(m,event));
}
