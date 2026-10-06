-- Synthetic users and invitations only; every write is rolled back.
begin;
do $test$
declare u uuid:=gen_random_uuid();other_u uuid:=gen_random_uuid();member_u uuid:=gen_random_uuid();h uuid;other_h uuid;code text;cancel_code text;changed integer;failed boolean;
begin
 insert into auth.users(id,aud,role,email) values
 (u,'authenticated','authenticated',u||'@invitation.invalid'),
 (other_u,'authenticated','authenticated',other_u||'@invitation.invalid'),
 (member_u,'authenticated','authenticated',member_u||'@invitation.invalid');
 perform set_config('request.jwt.claim.sub',u::text,true);execute 'set local role authenticated';
 h:=public.initialize_household('Invite test','Owner');
 code:=public.create_household_invite(h);cancel_code:=public.create_household_invite(h);
 perform set_config('request.jwt.claim.sub',other_u::text,true);
 other_h:=public.initialize_household('Other test','Other');
 assert not exists(select 1 from public.household_invites where household_id=h),'foreign codes hidden';
 update public.household_invites set revoked_at=now() where household_id=h;get diagnostics changed=row_count;assert changed=0,'foreign owner cannot cancel';
 perform set_config('request.jwt.claim.sub',member_u::text,true);
 perform public.join_household_by_code(code,'Member');
 assert not exists(select 1 from public.household_invites where household_id=h),'member cannot read codes';
 update public.household_invites set revoked_at=now() where household_id=h;get diagnostics changed=row_count;assert changed=0,'member cannot cancel';
 perform set_config('request.jwt.claim.sub',u::text,true);
 update public.household_invites i set revoked_at=now() where i.household_id=h and i.code=cancel_code and i.revoked_at is null;get diagnostics changed=row_count;assert changed=1,'owner cancels own invitation';
 perform set_config('request.jwt.claim.sub',other_u::text,true);
 failed:=false;begin perform public.join_household_by_code(cancel_code,'Other');exception when others then failed:=true;end;assert failed,'cancelled code does not admit users';
 perform set_config('request.jwt.claim.sub',member_u::text,true);
 assert exists(select 1 from public.household_members where household_id=h and user_id=member_u),'existing member remains';
 execute 'reset role';
end $test$;
rollback;
