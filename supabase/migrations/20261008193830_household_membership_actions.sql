begin;
-- All membership lifecycle actions serialize on the household row.
-- Keep the existing RLS policies; expose only invoker wrappers.
create or replace function private.guard_household_ownership()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.user_id is distinct from old.user_id then
  raise exception 'No se puede cambiar la identidad de un miembro.' using errcode='23514';
 end if;
 if old.role='OWNER' and (tg_op='DELETE' or new.role is distinct from old.role) then
  perform 1 from public.households where id=old.household_id for update;
  -- A deliberate household deletion may cascade; this guard concerns membership.
  if found and not exists(select 1 from public.household_members where household_id=old.household_id and role='OWNER' and user_id<>old.user_id) then
   raise exception 'Transfiere primero la propiedad del hogar.' using errcode='23514';
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.guard_household_ownership() from public,anon,authenticated;
create trigger household_owner_guard before update or delete on public.household_members
for each row execute function private.guard_household_ownership();

create or replace function private.transfer_household_ownership(p_household uuid,p_new_owner uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Inicia sesión.' using errcode='42501';end if;
 perform 1 from public.households where id=p_household for update;
 if not exists(select 1 from public.household_members where household_id=p_household and user_id=uid and role='OWNER') then
  raise exception 'Solo el propietario puede transferir el hogar.' using errcode='42501';
 end if;
 if p_new_owner=uid or p_new_owner is null then raise exception 'Elige otro miembro del hogar.' using errcode='22023';end if;
 if not exists(select 1 from public.household_members where household_id=p_household and user_id=p_new_owner and role='MEMBER') then
  raise exception 'La persona elegida debe ser miembro de este hogar. Actualiza los datos.' using errcode='22023';
 end if;
 -- Promote first: the household never has zero owners, even inside the transaction.
 update public.household_members set role='OWNER' where household_id=p_household and user_id=p_new_owner;
 update public.household_members set role='MEMBER' where household_id=p_household and user_id=uid;
 return jsonb_build_object('household_id',p_household,'new_owner_id',p_new_owner,'previous_owner_id',uid);
end $$;

create or replace function private.leave_household(p_household uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();member_role text;
begin
 if uid is null then raise exception 'Inicia sesión.' using errcode='42501';end if;
 perform 1 from public.households where id=p_household for update;
 select role::text into member_role from public.household_members where household_id=p_household and user_id=uid;
 if member_role='OWNER' then raise exception 'Transfiere primero la propiedad del hogar.' using errcode='42501';end if;
 -- Missing membership is a safe no-op, so a lost response can be retried.
 if member_role is not null then
  delete from public.push_subscriptions where household_id=p_household and user_id=uid;
  delete from public.notification_preferences where household_id=p_household and user_id=uid;
  delete from public.notification_events where household_id=p_household and user_id=uid;
  delete from public.household_members where household_id=p_household and user_id=uid;
 end if;
 return jsonb_build_object('household_id',p_household,'user_id',uid,'left',true);
end $$;
revoke all on function private.transfer_household_ownership(uuid,uuid),private.leave_household(uuid) from public,anon,authenticated;
grant execute on function private.transfer_household_ownership(uuid,uuid),private.leave_household(uuid) to authenticated;
create or replace function public.transfer_household_ownership(p_household uuid,p_new_owner uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.transfer_household_ownership(p_household,p_new_owner);$$;
create or replace function public.leave_household(p_household uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.leave_household(p_household);$$;
revoke all on function public.transfer_household_ownership(uuid,uuid),public.leave_household(uuid) from public,anon,authenticated;
grant execute on function public.transfer_household_ownership(uuid,uuid),public.leave_household(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
