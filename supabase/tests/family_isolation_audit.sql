-- Audit executed in separate rollback transactions: synthetic users only.
-- Storage bucket/policies are inspected; no physical uploads/downloads or push delivery.
-- Entirely synthetic users, households and Storage metadata. No physical uploads.
-- Run as the administrative SQL connection; every fixture is rolled back.
begin;
do $audit$
declare owner_a uuid:=gen_random_uuid();owner_b uuid:=gen_random_uuid();member_id uuid:=gen_random_uuid();
 a uuid;b uuid;code_a text;code_b text;expired text;revoked text;exhausted text;
 tx uuid;doc uuid;path text;task uuid;item uuid;n integer;blocked boolean;call text;tab text;
begin
 insert into auth.users(id,aud,role,email) values
 (owner_a,'authenticated','authenticated',owner_a||'@isolation.invalid'),
 (owner_b,'authenticated','authenticated',owner_b||'@isolation.invalid'),
 (member_id,'authenticated','authenticated',member_id||'@isolation.invalid');
 perform set_config('request.jwt.claim.sub',owner_a::text,true);execute 'set local role authenticated';
 a:=public.initialize_household('Audit A','Owner A','Audit account',12,current_date);
 code_a:=public.create_household_invite(a);expired:=public.create_household_invite(a);revoked:=public.create_household_invite(a);exhausted:=public.create_household_invite(a);
 update public.household_invites set expires_at=now()-interval '1 minute' where code=expired;
 update public.household_invites set revoked_at=now() where code=revoked;
 update public.household_invites set uses=max_uses where code=exhausted;
 insert into public.transactions(household_id,transaction_date,type,amount,concept,created_by,learn_category)
 values(a,'2040-01-01','GASTO',3,'Audit only',owner_a,false) returning id into tx;
 insert into public.transaction_documents(household_id,transaction_id,filename,mime_type,extension,size_bytes,sha256)
 values(a,tx,'audit.pdf','application/pdf','pdf',12,repeat('d',64)) returning id,object_path into doc,path;
 insert into public.family_tasks(household_id,title,created_by) values(a,'Audit task',owner_a) returning id into task;
 insert into public.shopping_items(household_id,name) values(a,'Audit item') returning id into item;
 perform set_config('request.jwt.claim.sub',owner_b::text,true);
 b:=public.initialize_household('Audit B','Owner B','Other account',34,current_date);code_b:=public.create_household_invite(b);
 -- Test the exposed tables AND views, not just the app's filtered queries.
 foreach tab in array array['categories','accounts','transactions','recurring_rules','investments','assets','liabilities','savings_goals','budgets','payees','tags','normalization_schedules','normalized_allocations','account_balance_snapshots','investment_valuations','asset_valuations','liability_snapshots','liability_balance_snapshots','net_worth_snapshots','reconciliations','monthly_closures','audit_log','category_rules','shopping_items','family_tasks','transaction_documents','household_members','household_invites','notification_preferences','push_subscriptions','notification_events','account_balances_current','investment_values_current','savings_goals_current'] loop
  execute format('select count(*) from public.%I where household_id=$1',tab) into n using a;
  assert n=0,'foreign household visible in '||tab;
 end loop;
 assert not exists(select 1 from public.households where id=a),'foreign household hidden';
 assert not exists(select 1 from public.profiles where id=owner_a),'foreign profile hidden';
 assert not exists(select 1 from public.transaction_tags where transaction_id=tx),'foreign tags hidden';
 assert not exists(select 1 from storage.objects where name=path and bucket_id='finanzas-documents'),'foreign file hidden';
 update public.transactions set concept='forbidden' where id=tx;get diagnostics n=row_count;assert n=0,'foreign update denied';

 execute 'reset role';end $audit$;
rollback;
select 'PASS' result;
-- Entirely synthetic users, households and Storage metadata. No physical uploads.
-- Run as the administrative SQL connection; every fixture is rolled back.
begin;
do $audit$
declare owner_a uuid:=gen_random_uuid();owner_b uuid:=gen_random_uuid();member_id uuid:=gen_random_uuid();
 a uuid;b uuid;code_a text;code_b text;expired text;revoked text;exhausted text;
 tx uuid;doc uuid;path text;task uuid;item uuid;n integer;blocked boolean;call text;tab text;
begin
 insert into auth.users(id,aud,role,email) values
 (owner_a,'authenticated','authenticated',owner_a||'@isolation.invalid'),
 (owner_b,'authenticated','authenticated',owner_b||'@isolation.invalid'),
 (member_id,'authenticated','authenticated',member_id||'@isolation.invalid');
 perform set_config('request.jwt.claim.sub',owner_a::text,true);execute 'set local role authenticated';
 a:=public.initialize_household('Audit A','Owner A','Audit account',12,current_date);
 code_a:=public.create_household_invite(a);expired:=public.create_household_invite(a);revoked:=public.create_household_invite(a);exhausted:=public.create_household_invite(a);
 update public.household_invites set expires_at=now()-interval '1 minute' where code=expired;
 update public.household_invites set revoked_at=now() where code=revoked;
 update public.household_invites set uses=max_uses where code=exhausted;
 insert into public.transactions(household_id,transaction_date,type,amount,concept,created_by,learn_category)
 values(a,'2040-01-01','GASTO',3,'Audit only',owner_a,false) returning id into tx;
 insert into public.transaction_documents(household_id,transaction_id,filename,mime_type,extension,size_bytes,sha256)
 values(a,tx,'audit.pdf','application/pdf','pdf',12,repeat('d',64)) returning id,object_path into doc,path;
 insert into public.family_tasks(household_id,title,created_by) values(a,'Audit task',owner_a) returning id into task;
 insert into public.shopping_items(household_id,name) values(a,'Audit item') returning id into item;
 perform set_config('request.jwt.claim.sub',owner_b::text,true);
 b:=public.initialize_household('Audit B','Owner B','Other account',34,current_date);code_b:=public.create_household_invite(b);
 foreach call in array array[
  format('select public.monthly_metrics(%L::uuid,current_date)',a),
  format('select public.category_spend(%L::uuid,current_date)',a),
  format('select public.monthly_spending_series(%L::uuid,1)',a),
  format('select public.monthly_financial_trend(%L::uuid,1)',a),
  format('select public.expense_category_breakdown(%L::uuid,current_date,current_date)',a),
  format('select public.net_worth_summary(%L::uuid)',a),
  format('select public.net_worth_history(%L::uuid,1)',a),
  format('select public.capture_net_worth_snapshot(%L::uuid)',a),
  format('select public.materialize_recurring(%L::uuid)',a),
  format('select public.find_potential_duplicates(%L::uuid,current_date,3,''GASTO'',''Audit'')',a),
  format('select public.month_duplicate_candidates(%L::uuid,current_date)',a),
  format('select public.create_household_invite(%L::uuid)',a),
  format('select public.close_month(%L::uuid,''2001-01-01'')',a),
  format('select public.reopen_month(%L::uuid,''2001-01-01'')',a),
  format('select public.restore_household_backup(%L::uuid,''{}''::jsonb)',a),
  format('select public.import_bank_transactions(%L::uuid,''[]''::jsonb)',a)
 ] loop
  blocked:=false;begin execute call;exception when raise_exception or insufficient_privilege then blocked:=true;end;
  assert blocked,'foreign RPC did not reject: '||call;
 end loop;
 assert not public.is_household_member(a) and not public.is_household_owner(a),'foreign role false';
 assert (public.transaction_sync_state(a)->>'transactions_count')::integer=0,'sync leaks no foreign rows';
 foreach call in array array[expired,revoked,exhausted,'INVALID-CODE'] loop
  blocked:=false;begin perform public.join_household_by_code(call,'Blocked');exception when raise_exception then blocked:=true;end;assert blocked,'invalid invite admitted user';
 end loop;

 execute 'reset role';end $audit$;
rollback;
select 'PASS' result;
-- Entirely synthetic users, households and Storage metadata. No physical uploads.
-- Run as the administrative SQL connection; every fixture is rolled back.
begin;
do $audit$
declare owner_a uuid:=gen_random_uuid();owner_b uuid:=gen_random_uuid();member_id uuid:=gen_random_uuid();
 a uuid;b uuid;code_a text;code_b text;expired text;revoked text;exhausted text;
 tx uuid;doc uuid;path text;task uuid;item uuid;n integer;blocked boolean;call text;tab text;
begin
 insert into auth.users(id,aud,role,email) values
 (owner_a,'authenticated','authenticated',owner_a||'@isolation.invalid'),
 (owner_b,'authenticated','authenticated',owner_b||'@isolation.invalid'),
 (member_id,'authenticated','authenticated',member_id||'@isolation.invalid');
 perform set_config('request.jwt.claim.sub',owner_a::text,true);execute 'set local role authenticated';
 a:=public.initialize_household('Audit A','Owner A','Audit account',12,current_date);
 code_a:=public.create_household_invite(a);expired:=public.create_household_invite(a);revoked:=public.create_household_invite(a);exhausted:=public.create_household_invite(a);
 update public.household_invites set expires_at=now()-interval '1 minute' where code=expired;
 update public.household_invites set revoked_at=now() where code=revoked;
 update public.household_invites set uses=max_uses where code=exhausted;
 insert into public.transactions(household_id,transaction_date,type,amount,concept,created_by,learn_category)
 values(a,'2040-01-01','GASTO',3,'Audit only',owner_a,false) returning id into tx;
 insert into public.transaction_documents(household_id,transaction_id,filename,mime_type,extension,size_bytes,sha256)
 values(a,tx,'audit.pdf','application/pdf','pdf',12,repeat('d',64)) returning id,object_path into doc,path;
 insert into public.family_tasks(household_id,title,created_by) values(a,'Audit task',owner_a) returning id into task;
 insert into public.shopping_items(household_id,name) values(a,'Audit item') returning id into item;
 perform set_config('request.jwt.claim.sub',owner_b::text,true);
 b:=public.initialize_household('Audit B','Owner B','Other account',34,current_date);code_b:=public.create_household_invite(b);
 -- One member in two households: permissions and cleanup must stay scoped.
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 perform public.join_household_by_code(code_a,'Member');perform public.join_household_by_code(code_b,'Member');
 assert exists(select 1 from public.shopping_items where id=item),'member can read shopping';
 update public.shopping_items set purchased=true where id=item;get diagnostics n=row_count;assert n=1,'ordinary member can collaborate';
 update public.households set name='unauthorized' where id=a;get diagnostics n=row_count;assert n=0,'member cannot edit household';
 update public.household_members set role='OWNER' where household_id=a and user_id=member_id;get diagnostics n=row_count;assert n=0,'member cannot promote self';
 blocked:=false;begin perform public.create_household_invite(a);exception when raise_exception then blocked:=true;end;assert blocked,'member cannot invite';
 blocked:=false;begin perform public.close_month(a,'2001-01-01');exception when raise_exception then blocked:=true;end;assert blocked,'member cannot close';
 blocked:=false;begin perform public.reopen_month(a,'2001-01-01');exception when raise_exception then blocked:=true;end;assert blocked,'member cannot reopen';
 blocked:=false;begin perform public.restore_household_backup(a,'{}');exception when raise_exception then blocked:=true;end;assert blocked,'member cannot restore';
 blocked:=false;begin perform public.transfer_household_ownership(a,member_id);exception when insufficient_privilege then blocked:=true;end;assert blocked,'member cannot transfer';

execute 'reset role';end $audit$;rollback;select 'PASS: member cannot perform owner actions' result;
begin;
do $test$
declare u uuid:=gen_random_uuid();m uuid:=gen_random_uuid();a uuid;b uuid;code text;othercode text;
begin
 insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated',u||'@notification-test.invalid'),(m,'authenticated','authenticated',m||'@notification-test.invalid');
 perform set_config('request.jwt.claim.sub',u::text,true);execute 'set local role authenticated';
 a:=public.initialize_household('Synthetic A','Test');b:=public.create_household('Synthetic B','Test');
 code:=public.create_household_invite(a);othercode:=public.create_household_invite(b);
 perform set_config('request.jwt.claim.sub',m::text,true);
 perform public.join_household_by_code(code,'Test');perform public.join_household_by_code(othercode,'Test');
 insert into public.notification_preferences(household_id,user_id,push_enabled) values(a,m,true),(b,m,true);
 insert into public.push_subscriptions(household_id,user_id,endpoint,p256dh,auth_key) values(a,m,'https://push.invalid/'||a,'test','test'),(b,m,'https://push.invalid/'||b,'test','test');
 execute 'reset role';
 insert into public.notification_events(household_id,user_id,kind,source_key,event_date,title,body) values(a,m,'TASK_DUE','synthetic-a',current_date,'Test','Test'),(b,m,'TASK_DUE','synthetic-b',current_date,'Test','Test');
 perform set_config('request.jwt.claim.sub',m::text,true);execute 'set local role authenticated';
 perform public.leave_household(a);
 execute 'reset role';
 assert not exists(select 1 from public.push_subscriptions where household_id=a and user_id=m),'revoked subscription removed';
 assert not exists(select 1 from public.notification_preferences where household_id=a and user_id=m),'revoked consent removed';
 assert not exists(select 1 from public.notification_events where household_id=a and user_id=m),'revoked event removed';
 assert exists(select 1 from public.push_subscriptions where household_id=b and user_id=m),'other household preserved';
 perform set_config('request.jwt.claim.sub',m::text,true);execute 'set local role authenticated';
 assert not public.is_household_member(a),'stale user identity denied';
 perform public.leave_household(b);execute 'reset role';
 assert not exists(select 1 from public.notification_events where user_id=m),'voluntary leave removed events';
 assert not exists(select 1 from public.push_subscriptions where user_id=m),'voluntary leave removed subscriptions';
end $test$;
rollback;select 'PASS: synthetic leave in two households and scoped notification cleanup' result;
begin;
set local role service_role;
do $$ begin assert public.refresh_notifications_for_user(gen_random_uuid(),gen_random_uuid(),current_date)=0,'cron cannot notify a non-member';end $$;
reset role;
do $$ begin
 assert (select not public from storage.buckets where id='finanzas-documents'),'private document bucket';
 assert (select qual like '%is_household_member(d.household_id)%' from pg_policies where schemaname='storage' and policyname='finance_documents_read'),'Storage requires current membership';
 assert (select with_check like '%is_household_member(d.household_id)%' from pg_policies where schemaname='storage' and policyname='finance_documents_upload'),'uploads require current membership';
 assert not has_schema_privilege('authenticated','public','create');
 assert not has_schema_privilege('authenticated','private','create');
 assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and has_function_privilege('anon',p.oid,'execute')),'anonymous privileged function';
end $$;
rollback;select 'PASS: Storage policy configuration, private bucket, function privileges and service non-member rejection' result;
