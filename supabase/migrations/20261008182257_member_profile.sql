-- A member may edit only their own display name. Keep the existing table RLS
-- unchanged: granting general member UPDATE would also permit role changes.
-- The narrowly privileged implementation stays outside the exposed API schema.
begin;
create schema if not exists private;
grant usage on schema private to authenticated;
create or replace function private.update_my_household_profile(p_household uuid,p_display_name text)
returns table(household_id uuid,user_id uuid,display_name text)
language plpgsql security definer set search_path='' as $$
declare clean text:=btrim(p_display_name); uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Inicia sesión para editar tu perfil.' using errcode='42501';end if;
 if clean is null or length(clean)<1 or length(clean)>120 then
  raise exception 'Escribe un nombre de entre 1 y 120 caracteres.' using errcode='22023';
 end if;
 return query update public.household_members m set display_name=clean
  where m.household_id=p_household and m.user_id=uid
  returning m.household_id,m.user_id,m.display_name;
 if not found then raise exception 'No perteneces a este hogar.' using errcode='42501';end if;
end $$;
revoke all on function private.update_my_household_profile(uuid,text) from public,anon,authenticated;
grant execute on function private.update_my_household_profile(uuid,text) to authenticated;

create or replace function public.update_my_household_profile(p_household uuid,p_display_name text)
returns table(household_id uuid,user_id uuid,display_name text)
language sql security invoker set search_path='' as $$
 select * from private.update_my_household_profile(p_household,p_display_name);
$$;
revoke all on function public.update_my_household_profile(uuid,text) from public,anon,authenticated;
grant execute on function public.update_my_household_profile(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
