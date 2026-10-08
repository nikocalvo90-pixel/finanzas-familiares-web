-- Check existing RLS using synthetic users only. All changes are rolled back.
begin;
do $test$
declare owner_id uuid:=gen_random_uuid();member_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();h uuid;other_h uuid;code text;changed integer;
begin
 insert into auth.users(id,aud,role,email) values
 (owner_id,'authenticated','authenticated',owner_id||'@household-settings.invalid'),
 (member_id,'authenticated','authenticated',member_id||'@household-settings.invalid'),
 (other_id,'authenticated','authenticated',other_id||'@household-settings.invalid');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);execute 'set local role authenticated';
 h:=public.initialize_household('Settings test','Owner');code:=public.create_household_invite(h);
 update public.households set name='Renamed household' where id=h;get diagnostics changed=row_count;assert changed=1,'owner renames own household';
 assert (select name='Renamed household' from public.households where id=h),'new name readable';
 perform set_config('request.jwt.claim.sub',member_id::text,true);perform public.join_household_by_code(code,'Member');
 update public.households set name='Member overwrite' where id=h;get diagnostics changed=row_count;assert changed=0,'member cannot rename';
 assert (select name='Renamed household' from public.households where id=h),'member sees unchanged shared name';
 perform set_config('request.jwt.claim.sub',other_id::text,true);other_h:=public.initialize_household('Other household','Other');
 update public.households set name='Foreign overwrite' where id=h;get diagnostics changed=row_count;assert changed=0,'foreign owner cannot rename';
 assert not exists(select 1 from public.households where id=h),'foreign household hidden';
 execute 'reset role';
end $test$;
rollback;
