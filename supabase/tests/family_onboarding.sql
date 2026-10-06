-- All identities and data are synthetic and rolled back.
begin;
do $test$
declare u uuid:=gen_random_uuid();other_u uuid:=gen_random_uuid();member_u uuid:=gen_random_uuid();h uuid;other_h uuid;retry_h uuid;code text;failed boolean;changed integer;before_count integer;
begin
 insert into auth.users(id,aud,role,email,raw_user_meta_data) values
 (u,'authenticated','authenticated',u||'@onboarding.invalid','{"display_name":"Test A"}'),
 (other_u,'authenticated','authenticated',other_u||'@onboarding.invalid','{"display_name":"Test B"}'),
 (member_u,'authenticated','authenticated',member_u||'@onboarding.invalid','{"display_name":"Test member"}');
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 failed:=false;begin perform public.initialize_household('Test A','Test','Banco',100,current_date+2);exception when invalid_parameter_value then failed:=true;end;
 assert failed,'invalid date rejected';assert not exists(select 1 from public.household_members where user_id=u),'invalid setup is atomic';
 failed:=false;begin perform public.initialize_household('Test A','Test','Banco','NaN'::numeric,current_date);exception when invalid_parameter_value then failed:=true;end;assert failed,'NaN rejected';
 h:=public.initialize_household('Test A','Test','Banco',1250.50,current_date-1);
 assert (select role='OWNER' from public.household_members where household_id=h and user_id=u),'creator is owner';
 assert (select count(*)>0 from public.categories where household_id=h),'default categories seeded';
 assert (select count(*)=1 from public.accounts where household_id=h),'one initial account';
 assert (select opening_balance=1250.50 from public.accounts where household_id=h),'opening balance preserved';
 assert (select count(*)=1 from public.account_balance_snapshots where household_id=h),'balance snapshot created';
 assert (select count(*)=0 from public.transactions where household_id=h),'opening balance is not income';
 retry_h:=public.initialize_household('Changed retry','Changed','Duplicate',99,current_date);
 assert retry_h=h,'retry recovers same household';assert (select count(*)=1 from public.accounts where household_id=h),'retry never duplicates account';
 assert (select name='Test A' from public.households where id=h),'retry never overwrites settings';
 code:=public.create_household_invite(h);
 perform set_config('request.jwt.claim.sub',other_u::text,true);
 other_h:=public.initialize_household('Test B','Test B');
 assert (select count(*)=0 from public.accounts where household_id=other_h),'account can be skipped';
 assert not exists(select 1 from public.households where id=h),'foreign household is invisible';
 assert not exists(select 1 from public.accounts where household_id=h),'foreign accounts invisible';
 assert not exists(select 1 from public.categories where household_id=h),'foreign categories invisible';
 update public.accounts set opening_balance=999 where household_id=h;get diagnostics changed=row_count;assert changed=0,'foreign update rejected';
 failed:=false;begin insert into public.accounts(household_id,name) values(h,'Foreign account');exception when insufficient_privilege then failed:=true;end;assert failed,'foreign insert rejected';
 failed:=false;begin perform public.create_household_invite(h);exception when others then failed:=true;end;assert failed,'foreign invite creation rejected';
 perform set_config('request.jwt.claim.sub',member_u::text,true);
 assert public.join_household_by_code(code,'Member')=h,'invitation joins correct household';
 assert (select role='MEMBER' from public.household_members where household_id=h and user_id=member_u),'invited role is member';
 assert public.initialize_household('Do not create','Member')=h,'existing member does not gain new household';
 execute 'reset role';
 assert (select count(*)=2 from public.households where created_by in (u,other_u,member_u)),'two independent households only';
 assert not has_function_privilege('anon','public.initialize_household(text,text,text,numeric,date)','EXECUTE'),'anonymous cannot create households';
 perform set_config('request.jwt.claim.sub','',true);execute 'set local role authenticated';
 failed:=false;begin perform public.initialize_household('Anonymous','Test');exception when insufficient_privilege then failed:=true;end;assert failed,'missing identity rejected';
 execute 'reset role';
end $test$;
rollback;
