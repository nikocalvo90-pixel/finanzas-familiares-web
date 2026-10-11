begin;
-- Runs for both voluntary leave and owner revocation, in the same transaction.
create or replace function private.cleanup_departed_member_notifications()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.push_subscriptions where household_id=old.household_id and user_id=old.user_id;
 delete from public.notification_preferences where household_id=old.household_id and user_id=old.user_id;
 delete from public.notification_events where household_id=old.household_id and user_id=old.user_id;
 return old;
end $$;
revoke all on function private.cleanup_departed_member_notifications() from public,anon,authenticated;
create trigger household_departure_notifications after delete on public.household_members
for each row execute function private.cleanup_departed_member_notifications();

CREATE OR REPLACE FUNCTION public.refresh_notifications_for_user(p_household uuid, p_user uuid, p_day date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_total integer := 0;
  v_n integer := 0;
  v_month_start date := date_trunc('month',p_day)::date;
  v_prev_month date := date_trunc('month',p_day - interval '1 month')::date;
  v_stale integer := 0;
begin
  if (select auth.uid()) is not null then
    if (select auth.uid()) <> p_user or not public.is_household_member(p_household) then
      raise exception 'Access denied';
    end if;
  elsif current_user <> 'service_role' then
    raise exception 'Access denied';
  end if;

  -- Service jobs also need a current membership, not merely a trusted role.
  if not exists (select 1 from public.household_members where household_id=p_household and user_id=p_user) then
    return 0;
  end if;

  insert into public.notification_preferences(household_id,user_id)
  values(p_household,p_user)
  on conflict(household_id,user_id) do nothing;

  update public.notification_events n
  set dismissed_at=now()
  where n.household_id=p_household
    and n.user_id=p_user
    and n.kind='TASK_DUE'
    and n.dismissed_at is null
    and n.source_id is not null
    and not exists (
      select 1
      from public.family_tasks t
      where t.id=n.source_id
        and t.household_id=p_household
        and t.status='PENDIENTE'
        and t.due_date is not null
        and t.reminder_days_before is not null
        and n.source_key=(
          'task:'||t.id::text||':reminder:'||t.reminder_days_before::text||':due:'||t.due_date::text
        )
    );

  insert into public.notification_events(
    household_id,user_id,kind,source_id,source_key,event_date,title,body,target_hash
  )
  select
    t.household_id,p_user,'TASK_DUE',t.id,
    'task:'||t.id::text||':reminder:'||coalesce(t.reminder_days_before,0)::text||':due:'||t.due_date::text,
    (t.due_date - coalesce(t.reminder_days_before,0)),
    case
      when t.due_date < p_day then 'Tarea pendiente'
      when t.due_date = p_day then 'Tarea para hoy'
      when t.due_date = p_day + 1 then 'Tarea para mañana'
      else 'Tarea próxima'
    end,
    t.title,
    '#tareas'
  from public.family_tasks t
  where t.household_id=p_household
    and t.status='PENDIENTE'
    and t.due_date is not null
    and t.reminder_days_before is not null
    and (t.due_date - t.reminder_days_before) <= p_day
    and (t.due_date - t.reminder_days_before) >= p_day-7
    and (t.assigned_to_user_id is null or t.assigned_to_user_id=p_user)
    and coalesce((select np.tasks_enabled from public.notification_preferences np where np.household_id=p_household and np.user_id=p_user),true)
  on conflict(user_id,source_key,event_date) do nothing;
  get diagnostics v_n=row_count; v_total:=v_total+v_n;

  insert into public.notification_events(
    household_id,user_id,kind,source_id,source_key,event_date,title,body,target_hash
  )
  select
    r.household_id,p_user,'RECURRING_DUE',r.id,
    'recurring:'||r.id::text||':due:'||r.next_due_date::text,
    r.next_due_date,
    case when r.next_due_date=p_day then 'Recurrente de hoy' else 'Recurrente mañana' end,
    r.name||' · '||to_char(r.amount,'FM999G999G990D00')||' €'||case when r.auto_post then ' · automático' else '' end,
    '#ajustes'
  from public.recurring_rules r
  where r.household_id=p_household
    and r.active
    and r.next_due_date between p_day and p_day+1
    and (r.person_user_id is null or r.person_user_id=p_user)
    and coalesce((select np.recurring_enabled from public.notification_preferences np where np.household_id=p_household and np.user_id=p_user),true)
  on conflict(user_id,source_key,event_date) do nothing;
  get diagnostics v_n=row_count; v_total:=v_total+v_n;

  insert into public.notification_events(
    household_id,user_id,kind,source_id,source_key,event_date,title,body,target_hash
  )
  select
    g.household_id,p_user,'GOAL_DUE',g.id,
    'goal:'||g.id::text||':target:'||g.target_date::text,
    g.target_date,
    case
      when g.target_date<p_day then 'Objetivo con fecha vencida'
      when g.target_date=p_day then 'Objetivo para hoy'
      else 'Objetivo próximo'
    end,
    g.name||' · faltan '||to_char(g.remaining_amount,'FM999G999G990D00')||' €',
    '#objetivos'
  from public.savings_goals_current g
  where g.household_id=p_household
    and not g.is_archived
    and g.remaining_amount>0
    and g.target_date is not null
    and g.target_date between p_day-7 and p_day+30
    and coalesce((select np.goals_enabled from public.notification_preferences np where np.household_id=p_household and np.user_id=p_user),true)
  on conflict(user_id,source_key,event_date) do nothing;
  get diagnostics v_n=row_count; v_total:=v_total+v_n;

  if extract(day from p_day)>=2
     and exists (
       select 1 from public.household_members hm
       where hm.household_id=p_household and hm.user_id=p_user and hm.role='OWNER'
     )
     and coalesce((select np.month_close_enabled from public.notification_preferences np where np.household_id=p_household and np.user_id=p_user),true)
     and not exists (
       select 1 from public.monthly_closures mc
       where mc.household_id=p_household and mc.month=v_prev_month and mc.status='CLOSED'
     )
  then
    insert into public.notification_events(
      household_id,user_id,kind,source_key,event_date,title,body,target_hash
    )
    values(
      p_household,p_user,'MONTH_CLOSE',
      'month-close:'||to_char(v_prev_month,'YYYY-MM'),
      v_month_start,
      'Cierre mensual pendiente',
      'El mes anterior sigue abierto. Revisa duplicados y ciérralo cuando esté correcto.',
      '#analisis'
    )
    on conflict(user_id,source_key,event_date) do nothing;
    get diagnostics v_n=row_count; v_total:=v_total+v_n;
  end if;

  if coalesce((select np.reconciliation_enabled from public.notification_preferences np where np.household_id=p_household and np.user_id=p_user),true) then
    with items as (
      select id from public.accounts where household_id=p_household and not is_archived
      union all
      select id from public.investments where household_id=p_household and not is_archived
      union all
      select id from public.assets where household_id=p_household and not is_archived
      union all
      select id from public.liabilities where household_id=p_household and not is_archived
    ),
    latest as (
      select entity_id,max(as_of_date) as last_date
      from public.reconciliations
      where household_id=p_household
      group by entity_id
    )
    select count(*) into v_stale
    from items i
    left join latest l on l.entity_id=i.id
    where l.last_date is null or l.last_date<p_day-30;

    if v_stale>0 then
      insert into public.notification_events(
        household_id,user_id,kind,source_key,event_date,title,body,target_hash
      )
      values(
        p_household,p_user,'RECONCILIATION',
        'reconciliation:'||to_char(v_month_start,'YYYY-MM'),
        v_month_start,
        'Revisión de patrimonio',
        v_stale||case when v_stale=1 then ' elemento lleva' else ' elementos llevan' end||' más de 30 días sin conciliar.',
        '#patrimonio'
      )
      on conflict(user_id,source_key,event_date) do nothing;
      get diagnostics v_n=row_count; v_total:=v_total+v_n;
    end if;
  end if;

  return v_total;
end;
$function$
;
commit;
