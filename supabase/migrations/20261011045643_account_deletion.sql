begin;
-- Supabase Auth's irreversible soft deletion clears credentials, identity metadata,
-- MFA and sessions. Keep opaque attribution IDs so closed financial history and
-- shared Storage objects never need to be rewritten or deleted.
create or replace function private.guard_account_deletion()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.deleted_at is null and new.deleted_at is not null then
  perform 1 from public.households h where exists(select 1 from public.household_members m where m.household_id=h.id and m.user_id=old.id) order by h.id for update;
  if exists(select 1 from public.household_members where user_id=old.id and role='OWNER') then
   raise exception 'Transfiere primero la propiedad de todos tus hogares.' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
create or replace function private.cleanup_deleted_account()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.deleted_at is null and new.deleted_at is not null then
  delete from public.push_subscriptions where user_id=new.id;
  delete from public.notification_preferences where user_id=new.id;
  delete from public.notification_events where user_id=new.id;
  delete from public.household_members where user_id=new.id;
  delete from public.profiles where id=new.id;
 end if;
 return new;
end $$;
-- A signed JWT may remain cryptographically valid after deletion. Prevent it
-- from rebuilding membership through create/join RPCs or a concurrent transfer.
create or replace function private.guard_active_household_member()
returns trigger language plpgsql security definer set search_path='' as $$
declare active boolean;
begin
 select deleted_at is null into active from auth.users where id=new.user_id for share;
 if not coalesce(active,false) then raise exception 'Esta cuenta ya no está disponible.' using errcode='42501';end if;
 return new;
end $$;
revoke all on function private.guard_account_deletion(),private.cleanup_deleted_account(),private.guard_active_household_member() from public,anon,authenticated;
create trigger casuo_account_deletion_guard before update of deleted_at on auth.users for each row execute function private.guard_account_deletion();
create trigger casuo_account_deletion_cleanup after update of deleted_at on auth.users for each row execute function private.cleanup_deleted_account();
create trigger household_active_user_guard before insert or update on public.household_members for each row execute function private.guard_active_household_member();
commit;
