begin;
do $test$
declare owner_id uuid:=gen_random_uuid();member_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();h uuid;other_h uuid;code text;r jsonb;
begin
 assert not has_function_privilege('anon','public.leave_household(uuid)','EXECUTE');
 assert not has_function_privilege('anon','public.transfer_household_ownership(uuid,uuid)','EXECUTE');
 insert into auth.users(id,aud,role,email) values
 (owner_id,'authenticated','authenticated',owner_id||'@membership-test.invalid'),
 (member_id,'authenticated','authenticated',member_id||'@membership-test.invalid'),
 (other_id,'authenticated','authenticated',other_id||'@membership-test.invalid');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);execute 'set local role authenticated';
 h:=public.initialize_household('Membership test','Owner','Preserved account',123,current_date);code:=public.create_household_invite(h);
 begin perform public.leave_household(h);raise exception 'owner left';exception when insufficient_privilege then null;end;
 begin update public.household_members set role='MEMBER' where household_id=h and user_id=owner_id;raise exception 'last owner demoted';exception when check_violation then null;end;
 begin perform public.transfer_household_ownership(h,owner_id);raise exception 'self transfer';exception when invalid_parameter_value then null;end;
 begin perform public.transfer_household_ownership(h,other_id);raise exception 'foreign transfer';exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claim.sub',member_id::text,true);perform public.join_household_by_code(code,'Member');
 begin perform public.transfer_household_ownership(h,owner_id);raise exception 'member transferred';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',other_id::text,true);other_h:=public.initialize_household('Other household','Other');
 begin perform public.transfer_household_ownership(h,member_id);raise exception 'foreign owner transferred';exception when insufficient_privilege then null;end;
 perform public.leave_household(h); -- no-op must not remove somebody else
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 r:=public.transfer_household_ownership(h,member_id);assert (r->>'new_owner_id')::uuid=member_id;
 assert (select role='MEMBER' from public.household_members where household_id=h and user_id=owner_id);
 assert (select role='OWNER' from public.household_members where household_id=h and user_id=member_id);
 r:=public.leave_household(h);assert (r->>'left')::boolean;
 assert not exists(select 1 from public.household_members where household_id=h and user_id=owner_id);
 perform public.leave_household(h); -- retry after an already completed leave
 assert not public.is_household_member(h),'departed user loses RLS membership';
 assert not exists(select 1 from public.households where id=h),'departed user cannot read household';
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 assert (select name='Membership test' from public.households where id=h),'household remains';
 assert exists(select 1 from public.categories where household_id=h),'shared records remain';
 assert exists(select 1 from public.accounts where household_id=h and name='Preserved account'),'financial account preserved';
 begin perform public.leave_household(h);raise exception 'new owner left';exception when insufficient_privilege then null;end;
 execute 'reset role';
 begin delete from public.household_members where household_id=h and user_id=member_id;raise exception 'last owner deleted';exception when check_violation then null;end;
end $test$;
rollback;
