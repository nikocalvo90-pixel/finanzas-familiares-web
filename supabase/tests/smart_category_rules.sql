-- Run via the management SQL connection. All synthetic data is rolled back.
begin;
do $$
declare h uuid; u uuid; a uuid;
begin
  select household_id,user_id into h,u from public.household_members order by joined_at limit 1;
  select id into a from public.accounts where household_id=h and not is_archived limit 1;
  if h is null or a is null then raise exception 'A household member and active account are required for this integration test'; end if;
  perform set_config('test.rules_household',h::text,true);
  perform set_config('test.rules_user',u::text,true);
  perform set_config('test.rules_account',a::text,true);
  perform set_config('request.jwt.claim.sub',u::text,true);
end $$;
set local role authenticated;
do $$
declare
  h uuid:=current_setting('test.rules_household')::uuid;
  u uuid:=current_setting('test.rules_user')::uuid;
  a uuid:=current_setting('test.rules_account')::uuid;
  c1 uuid; c2 uuid; ci uuid; t uuid; r uuid; n integer; failed boolean; result jsonb;
  p text:='rules test '||replace(gen_random_uuid()::text,'-','');
  marker text:='rules-test:'||gen_random_uuid()::text;
begin
  assert public.normalize_rule_text('  CAFÉ / España  ')='cafe espana','normalization';
  insert into public.categories(household_id,name,kind) values(h,'Synthetic rules test one','GASTO') returning id into c1;
  insert into public.categories(household_id,name,kind) values(h,'Synthetic rules test two','GASTO') returning id into c2;
  insert into public.categories(household_id,name,kind) values(h,'Synthetic rules test income','INGRESO') returning id into ci;
  insert into public.transactions(household_id,transaction_date,amount,type,concept,category_id,account_id,created_by,classification_confirmed)
    values(h,'2040-01-01',1,'GASTO',p,c1,a,u,true) returning id into t;
  assert not exists(select 1 from public.category_rules where household_id=h and pattern=p),'unmarked suggestions must not train';
  update public.transactions set category_id=c2,learn_category=true where id=t;
  select id into r from public.category_rules where household_id=h and pattern=p;
  assert r is not null,'confirmed correction learned';
  assert (select category_id=c2 and origin='LEARNED' and confirmations=1 from public.category_rules where id=r),'learned category';
  update public.transactions set notes='An unrelated edit' where id=t;
  assert (select confirmations=1 from public.category_rules where id=r),'no learning from unrelated edits';
  update public.category_rules set active=false where id=r;
  update public.transactions set category_id=c1 where id=t;
  assert (select not active and category_id=c2 and confirmations=1 from public.category_rules where id=r),'paused rules stay paused';
  update public.category_rules set active=true where id=r;
  update public.transactions set category_id=c2 where id=t;
  assert (select confirmations=2 from public.category_rules where id=r),'active rules learn again';
  update public.transactions set category_id=c1,learn_category=false where id=t;
  assert (select category_id=c2 and confirmations=2 from public.category_rules where id=r),'unchecked Remember respected';
  failed:=false;
  begin update public.transactions set category_id=ci,learn_category=true where id=t;
  exception when others then failed:=true; end;
  assert failed,'wrong category kind rejected';
  assert (select category_id=c1 from public.transactions where id=t),'failed learning rolls back transaction edit';
  assert (public.transaction_sync_state(h)->>'category_rules_count')::integer>0,'shared sync includes rules';

  result:=public.import_bank_transactions(h,jsonb_build_array(jsonb_build_object(
    'transaction_date','2040-01-01','amount',2,'type','GASTO','concept',p||' import',
    'category_id',c1,'account_id',a,'external_id',marker,'classification_confirmed',true,'learn_category',true)));
  assert (result->>'inserted_count')::int=1,'bank import saved';
  assert exists(select 1 from public.category_rules where household_id=h and pattern=p||' import' and confirmations=1),'bank correction learned';
  result:=public.import_bank_transactions(h,jsonb_build_array(jsonb_build_object(
    'transaction_date','2040-01-01','amount',2,'type','GASTO','concept',p||' import',
    'category_id',c2,'account_id',a,'external_id',marker,'classification_confirmed',true,'learn_category',true)));
  assert (result->>'skipped_existing_count')::int=1,'duplicate skipped';
  assert exists(select 1 from public.category_rules where household_id=h and pattern=p||' import' and category_id=c1 and confirmations=1),'duplicate did not train';
  failed:=false;
  begin
    perform public.import_bank_transactions(h,jsonb_build_array(
      jsonb_build_object('concept',p||' conflict','type','GASTO','category_id',c1,'learn_category',true),
      jsonb_build_object('concept',p||' conflict','type','GASTO','category_id',c2,'learn_category',true)));
  exception when others then failed:=true; end;
  assert failed,'contradictory batch corrections blocked';
  assert not exists(select 1 from public.category_rules where household_id=h and pattern=p||' conflict'),'no partial conflict learning';
  failed:=false;
  begin update public.category_rules set household_id=gen_random_uuid() where id=r;
  exception when others then failed:=true; end;
  assert failed,'rule cannot move households';
  failed:=false;
  begin insert into public.category_rules(household_id,pattern,transaction_type,category_id)
    values(h,p||' invalid','GASTO',ci);
  exception when others then failed:=true; end;
  assert failed,'manual rules validate category kind';

  perform set_config('test.rules_rule',r::text,true);
  perform set_config('test.rules_category',c1::text,true);
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  assert not exists(select 1 from public.category_rules where household_id=h),'outsider cannot read';
  update public.category_rules set active=false where id=r;
  get diagnostics n=row_count; assert n=0,'outsider cannot update';
  failed:=false;
  begin insert into public.category_rules(household_id,pattern,transaction_type,category_id) values(h,p||' outsider','GASTO',c1);
  exception when others then failed:=true; end;
  assert failed,'outsider cannot insert';
end $$;
reset role;
set local role anon;
do $$
declare failed boolean:=false;
begin
  begin perform 1 from public.category_rules limit 1;
  exception when insufficient_privilege then failed:=true; end;
  assert failed,'anonymous access denied';
end $$;
reset role;
rollback;
select 'PASS: learning, pause, corrections, atomic rollback, import duplicates, conflicts, sync and RLS; all fixture data rolled back' result;
