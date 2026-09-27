begin;
do $$
declare h uuid;u uuid;v uuid;
begin
 select household_id,user_id into h,u from public.household_members where role='OWNER' order by joined_at limit 1;
 select user_id into v from public.household_members where household_id=h and role<>'OWNER' limit 1;
 assert h is not null,'owner required';
 perform set_config('test.restore_h',h::text,true);perform set_config('test.restore_u',u::text,true);perform set_config('test.restore_v',coalesce(v::text,''),true);
 perform set_config('request.jwt.claim.sub',u::text,true);
end $$;
set local role authenticated;
do $$
declare h uuid:=current_setting('test.restore_h')::uuid;i uuid:=gen_random_uuid();j uuid:=gen_random_uuid();d uuid:=gen_random_uuid();p jsonb;r jsonb;ap jsonb;original jsonb;failed boolean;before_audit bigint;tx uuid:=gen_random_uuid();rr uuid:=gen_random_uuid();sch uuid:=gen_random_uuid();
begin
 select count(*) into before_audit from public.audit_log where household_id=h;
 p:=jsonb_build_object('households',jsonb_build_array(jsonb_build_object('id',h)),'shopping_items',jsonb_build_array(jsonb_build_object('id',i,'household_id',h,'name','Restore synthetic '||i,'quantity','2','note','','section','Otros','favorite',true,'purchased',false,'archived',false)));
 r:=public.restore_household_backup(h,p,null,null);assert (r->>'ok')::boolean and not (r->>'applied')::boolean,'null apply is preview';assert not exists(select 1 from public.shopping_items where id=i),'null apply cannot write';
 r:=public.restore_household_backup(h,p);assert (r->>'ok')::boolean,r::text;assert r#>>'{tables,shopping_items,add}'='1','preview count';
 assert not exists(select 1 from public.shopping_items where id=i),'preview writes rolled back';
 assert (select count(*)=before_audit from public.audit_log where household_id=h),'preview audit rolled back';
 ap:=public.restore_household_backup(h,p,true,r->>'token');assert (ap->>'ok')::boolean,ap::text;
 assert exists(select 1 from public.shopping_items where id=i),'apply inserts';
 ap:=public.restore_household_backup(h,p,true,r->>'token');assert not (ap->>'ok')::boolean,'stale preview rejected';
 select to_jsonb(t) into original from public.shopping_items t where id=i;
 p:=jsonb_set(p,'{shopping_items}',jsonb_build_array(original));r:=public.restore_household_backup(h,p);assert r#>>'{tables,shopping_items,existing}'='1',r::text;
 p:=jsonb_set(p,'{shopping_items,0,quantity}','"99"');r:=public.restore_household_backup(h,p);assert jsonb_array_length(r->'conflicts')=1,'conflict shown';
 ap:=public.restore_household_backup(h,p,true,r->>'token');assert (ap->>'ok')::boolean,ap::text;assert (select quantity='2' from public.shopping_items where id=i),'no overwrite';
 p:=jsonb_set(p,'{shopping_items}',jsonb_build_array(jsonb_build_object('id',j,'household_id',h,'name','Rollback '||j),jsonb_build_object('id',gen_random_uuid(),'household_id',gen_random_uuid(),'name','Foreign')));
 r:=public.restore_household_backup(h,p);assert not (r->>'ok')::boolean,'foreign input blocked';assert not exists(select 1 from public.shopping_items where id=j),'entire failed batch rolled back';
 p:=jsonb_build_object('households',jsonb_build_array(jsonb_build_object('id',h)),'transaction_documents',jsonb_build_array(jsonb_build_object('id',d,'household_id',h,'transaction_id',null,'transaction_label','Deleted historical transaction','transaction_date','2040-01-01','filename','restore.pdf','mime_type','application/pdf','extension','pdf','size_bytes',12,'sha256',repeat('a',64),'status','READY','archived',true)));
 r:=public.restore_household_backup(h,p);assert (r->>'ok')::boolean,r::text;assert jsonb_array_length(r->'documents')=1,'orphan upload planned';
 ap:=public.restore_household_backup(h,p,true,r->>'token');assert (ap->>'ok')::boolean,ap::text;
 assert (select status='PENDING' and archived and transaction_id is null from public.transaction_documents where id=d),'orphan pending preserved';
 insert into storage.objects(bucket_id,name,metadata) values('finanzas-documents',h::text||'/'||d::text||'.pdf','{"size":12,"mimetype":"application/pdf"}');
 update public.transaction_documents set status='READY' where id=d;
 failed:=false;begin update public.transaction_documents set status='PENDING' where id=d;exception when others then failed:=true;end;assert failed,'existing originals immutable';
 select to_jsonb(t) into original from public.transactions t where household_id=h and type='GASTO' limit 1;
 assert original is not null,'expense fixture required';
 original:=original||jsonb_build_object('id',tx,'transaction_date','2040-03-01','amount',1,'concept','Synthetic restored expense','external_id','restore-test:'||tx,'learn_category',true,'recurring_rule_id',rr,'recurring_due_date',null,'reimburses_transaction_id',null);
 p:=jsonb_build_object('households',jsonb_build_array(jsonb_build_object('id',h)),
 'recurring_rules',jsonb_build_array(jsonb_build_object('id',rr,'household_id',h,'created_by',current_setting('test.restore_u'),'name','Synthetic recurring restore','type','GASTO','amount',1,'concept','Synthetic recurring','account_id',original->'account_id','frequency','MENSUAL','interval_count',1,'start_date','2040-03-01','next_due_date','2040-03-01','active',true,'auto_post',true)),
 'transactions',jsonb_build_array(original),
 'normalization_schedules',jsonb_build_array(jsonb_build_object('id',sch,'household_id',h,'created_by',current_setting('test.restore_u'),'transaction_id',tx,'start_month','2040-03-01','months_count',2,'total_amount',1,'active',true)));
 r:=public.restore_household_backup(h,p);assert (r->>'ok')::boolean,r::text;
 assert not exists(select 1 from public.transactions where id=tx),'expense preview rolled back';
 ap:=public.restore_household_backup(h,p,true,r->>'token');assert (ap->>'ok')::boolean,ap::text;
 assert (select not learn_category from public.transactions where id=tx),'restore does not retrain categories';
 assert (select not active and not auto_post from public.recurring_rules where id=rr),'restored recurring rules paused';
 assert (select count(*)=2 and sum(amount)=1 from public.normalized_allocations where schedule_id=sch),'allocations regenerated consistently';
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 failed:=false;begin perform public.restore_household_backup(h,p);exception when others then failed:=true;end;assert failed,'outsider cannot restore';
 if current_setting('test.restore_v')<>'' then perform set_config('request.jwt.claim.sub',current_setting('test.restore_v'),true);failed:=false;begin perform public.restore_household_backup(h,p);exception when others then failed:=true;end;assert failed,'non-owner cannot restore';end if;
end $$;
reset role;
select 'PASS: preview rollback including audit, atomic apply, stale preview, unchanged records, no overwrite, foreign input, orphan metadata recovery and owner-only access. Physical Storage transport not exercised.' as result;
rollback;
