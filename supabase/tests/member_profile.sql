-- Synthetic users only. No changes survive this verification.
begin;
do $test$
declare owner_id uuid:=gen_random_uuid();member_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();h uuid;other_h uuid;code text;got text;changed integer;
begin
 assert not has_function_privilege('anon','public.update_my_household_profile(uuid,text)','EXECUTE'),'anonymous RPC denied';
 assert not has_function_privilege('anon','private.update_my_household_profile(uuid,text)','EXECUTE'),'anonymous implementation denied';
 assert not (select prosecdef from pg_proc where oid='public.update_my_household_profile(uuid,text)'::regprocedure),'public wrapper is invoker';
 insert into auth.users(id,aud,role,email) values
 (owner_id,'authenticated','authenticated',owner_id||'@profile-test.invalid'),
 (member_id,'authenticated','authenticated',member_id||'@profile-test.invalid'),
 (other_id,'authenticated','authenticated',other_id||'@profile-test.invalid');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);execute 'set local role authenticated';
 h:=public.initialize_household('Profile test','Owner');code:=public.create_household_invite(h);
 select display_name into got from public.update_my_household_profile(h,'  New owner  ');assert got='New owner';
 perform set_config('request.jwt.claim.sub',member_id::text,true);perform public.join_household_by_code(code,'Member');
 select display_name into got from public.update_my_household_profile(h,'  New member  ');assert got='New member';
 assert (select role='MEMBER' from public.household_members where household_id=h and user_id=member_id),'member role preserved';
 assert (select display_name='New owner' from public.household_members where household_id=h and user_id=owner_id),'another profile unchanged';
 update public.household_members set role='OWNER' where household_id=h and user_id=member_id;get diagnostics changed=row_count;assert changed=0,'no role escalation';
 begin perform public.update_my_household_profile(h,' ');raise exception 'blank accepted';exception when invalid_parameter_value then null;end;
 begin perform public.update_my_household_profile(h,repeat('x',121));raise exception 'long accepted';exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claim.sub',other_id::text,true);other_h:=public.initialize_household('Other profile household','Other');
 begin perform public.update_my_household_profile(h,'Foreign overwrite');raise exception 'foreign profile accepted';exception when insufficient_privilege then null;end;
 assert (select display_name='Other' from public.household_members where household_id=other_h and user_id=other_id),'own unrelated household unchanged';
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.update_my_household_profile(h,'No session');raise exception 'missing session accepted';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $test$;
rollback;
