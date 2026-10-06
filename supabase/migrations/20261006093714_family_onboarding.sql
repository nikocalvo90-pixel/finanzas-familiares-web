-- Bootstrap through existing authorized RPCs; keep caller permissions and RLS.
create or replace function public.initialize_household(
 p_name text,p_display_name text,p_account_name text default null,
 p_balance numeric default null,p_balance_date date default null
) returns uuid language plpgsql security invoker set search_path='' as $function$
declare v_uid uuid:=auth.uid();v_household uuid;v_today date:=(now() at time zone 'Europe/Madrid')::date;
begin
 if v_uid is null then raise exception 'Necesitas iniciar sesión' using errcode='42501';end if;
 -- Serialize retries from multiple tabs for the same user, never other users.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('family-onboarding:'||v_uid::text,0));
 select household_id into v_household from public.household_members where user_id=v_uid order by joined_at,household_id limit 1;
 if v_household is not null then return v_household;end if;
 if coalesce(length(trim(p_name)),0) not between 1 and 120 or coalesce(length(trim(p_display_name)),0) not between 1 and 120 then
  raise exception 'El nombre del hogar y tu nombre deben tener entre 1 y 120 caracteres' using errcode='22023';
 end if;
 if p_account_name is null then
  if p_balance is not null or p_balance_date is not null then raise exception 'Falta el nombre de la cuenta' using errcode='22023';end if;
 else
  if length(trim(p_account_name)) not between 1 and 120 or p_balance is null or p_balance::text in ('NaN','Infinity','-Infinity') or abs(p_balance)>=1000000000000 or round(p_balance,2)<>p_balance or p_balance_date is null or p_balance_date<'1900-01-01'::date or p_balance_date>v_today then
   raise exception 'Revisa el nombre, saldo y fecha de la primera cuenta' using errcode='22023';
  end if;
 end if;
 v_household:=public.create_household(trim(p_name),trim(p_display_name));
 if p_account_name is not null then
  perform public.create_account_from_app(v_household,trim(p_account_name),'CORRIENTE',null,null,p_balance,p_balance_date,true,true);
 end if;
 return v_household;
end $function$;
revoke all on function public.initialize_household(text,text,text,numeric,date) from public,anon;
grant execute on function public.initialize_household(text,text,text,numeric,date) to authenticated;
comment on function public.initialize_household(text,text,text,numeric,date) is 'Atomic first household setup. Caller RLS, existing bootstrap authorization, per-user retry lock; existing members are returned without modification.';
