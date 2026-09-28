-- Synthetic households, no real financial data changed. Run inside a transaction.
begin;
do $test$
declare u uuid;h uuid;other_h uuid;a uuid:=gen_random_uuid();other_a uuid:=gen_random_uuid();
 tx uuid:=gen_random_uuid();open_tx uuid:=gen_random_uuid();sch uuid:=gen_random_uuid();other_sch uuid:=gen_random_uuid();
 tag uuid:=gen_random_uuid();other_tag uuid:=gen_random_uuid();cat uuid;other_cat uuid;failed boolean;m jsonb;
begin
 select user_id into u from public.household_members where role='OWNER' order by joined_at limit 1;
 assert u is not null,'authenticated owner fixture required';
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 -- The owner can access BOTH households. RLS alone cannot reject these references.
 h:=public.create_household('Integrity regression A','Test');
 other_h:=public.create_household('Integrity regression B','Test');
 insert into public.accounts(id,household_id,name) values(a,h,'Test A'),(other_a,other_h,'Test B');
 select id into cat from public.categories where household_id=h and kind='GASTO' limit 1;
 select id into other_cat from public.categories where household_id=other_h and kind='GASTO' limit 1;
 insert into public.transactions(id,household_id,created_by,transaction_date,type,amount,concept,account_id,category_id,learn_category)
 values(tx,h,u,'2001-01-15','GASTO',120,'Closed cash test',a,cat,false),(open_tx,h,u,'2001-03-15','GASTO',120,'Normalized test',a,cat,false);
 insert into public.normalization_schedules(id,household_id,transaction_id,start_month,months_count,total_amount,created_by)
 values(sch,h,open_tx,'2001-02-01',2,120,u);
 insert into public.tags(id,household_id,name) values(tag,h,'Test A'),(other_tag,other_h,'Test B');
 insert into public.transaction_tags(transaction_id,tag_id) values(tx,tag);
 failed:=false;begin update public.transactions set account_id=other_a where id=tx;exception when foreign_key_violation then failed:=true;end;assert failed,'cross-household account blocked';
 failed:=false;begin update public.transactions set category_id=other_cat where id=tx;exception when foreign_key_violation then failed:=true;end;assert failed,'cross-household category blocked';
 failed:=false;begin insert into public.normalization_schedules(id,household_id,transaction_id,start_month,months_count,total_amount,created_by) values(other_sch,other_h,tx,'2001-01-01',1,120,u);exception when foreign_key_violation then failed:=true;end;assert failed,'cross-household schedule blocked';
 failed:=false;begin update public.normalized_allocations set household_id=other_h where schedule_id=sch;exception when check_violation then failed:=true;end;assert failed,'household cannot be reassigned';
 failed:=false;begin insert into public.normalized_allocations(household_id,schedule_id,period_month,amount) values(other_h,sch,'2001-05-01',1);exception when foreign_key_violation then failed:=true;end;assert failed,'cross-household allocation blocked';
 failed:=false;begin insert into public.transaction_tags(transaction_id,tag_id) values(tx,other_tag);exception when foreign_key_violation then failed:=true;end;assert failed,'cross-household tag blocked';
 failed:=false;begin insert into public.reconciliations(household_id,entity_type,entity_id,expected_value,actual_value,difference,created_by) values(h,'CUENTA',other_a,0,0,0,u);exception when foreign_key_violation then failed:=true;end;assert failed,'cross-household reconciliation blocked';
 failed:=false;begin update public.accounts set household_id=other_h where id=a;exception when check_violation then failed:=true;end;assert failed,'moving an entity to another household blocked';
 -- Optional FK deletion preserves the household rather than setting it to NULL.
 delete from public.accounts where id=a;
 assert (select account_id is null and household_id=h from public.transactions where id=tx),'SET NULL preserves household';
 -- Old cash dates and both old/new allocation months stay frozen after close.
 m:=public.close_month(h,'2001-01-01');
 assert (m->>'expenses')::numeric=120,'cash snapshot';
 failed:=false;begin update public.transactions set transaction_date='2001-04-01' where id=tx;exception when check_violation then failed:=true;end;assert failed,'cannot move a transaction OUT of a closed month';
 failed:=false;begin update public.transactions set transaction_date='2001-01-01' where id=open_tx;exception when check_violation then failed:=true;end;assert failed,'cannot move a transaction INTO a closed month';
 failed:=false;begin delete from public.transactions where id=tx;exception when check_violation then failed:=true;end;assert failed,'closed cash deletion blocked';
 failed:=false;begin insert into public.transactions(household_id,created_by,transaction_date,type,amount,concept,learn_category) values(h,u,'2001-01-10','GASTO',1,'Blocked',false);exception when check_violation then failed:=true;end;assert failed,'closed cash insertion blocked';
 failed:=false;begin insert into public.normalization_schedules(household_id,transaction_id,start_month,months_count,total_amount,created_by) values(h,tx,'2001-04-01',2,120,u);exception when check_violation then failed:=true;end;assert failed,'cannot periodize a closed cash transaction';
 m:=public.close_month(h,'2001-02-01');
 assert (m->>'normalized_cost')::numeric=60,'normalized snapshot';
 failed:=false;begin update public.transactions set exclude_from_normalized=true where id=open_tx;exception when check_violation then failed:=true;end;assert failed,'source cannot alter a closed allocation';
 failed:=false;begin update public.transactions set type='DEVOLUCION' where id=open_tx;exception when check_violation then failed:=true;end;assert failed,'source sign cannot alter a closed allocation';
 failed:=false;begin delete from public.transactions where id=open_tx;exception when check_violation then failed:=true;end;assert failed,'source deletion cannot remove closed allocations';
 failed:=false;begin update public.normalization_schedules set start_month='2001-04-01' where id=sch;exception when check_violation then failed:=true;end;assert failed,'cannot move a schedule away from closed periods';
 failed:=false;begin update public.normalization_schedules set active=false where id=sch;exception when check_violation then failed:=true;end;assert failed,'cannot disable a closed schedule';
 failed:=false;begin delete from public.normalization_schedules where id=sch;exception when check_violation then failed:=true;end;assert failed,'closed schedule deletion blocked';
 failed:=false;begin update public.normalized_allocations set period_month='2001-05-01' where schedule_id=sch and period_month='2001-02-01';exception when check_violation then failed:=true;end;assert failed,'cannot move an allocation OUT of a closed month';
 failed:=false;begin update public.normalized_allocations set amount=80 where schedule_id=sch and period_month='2001-02-01';exception when check_violation then failed:=true;end;assert failed,'closed allocation amount blocked';
 failed:=false;begin delete from public.normalized_allocations where schedule_id=sch and period_month='2001-02-01';exception when check_violation then failed:=true;end;assert failed,'closed allocation deletion blocked';
 failed:=false;begin perform public.close_month(h,'2099-01-01');exception when raise_exception then failed:=true;end;assert failed,'premature close blocked server-side';
 -- Reopen is the deliberate route for corrections.
 perform public.reopen_month(h,'2001-01-01');perform public.reopen_month(h,'2001-02-01');
 update public.transactions set transaction_date='2001-04-01' where id=tx;
 update public.normalization_schedules set total_amount=100 where id=sch;
 assert (select count(*)=2 and sum(amount)=100 from public.normalized_allocations where schedule_id=sch),'normalization still rebuilds after reopening';
 delete from public.transactions where id=open_tx;
 assert not exists(select 1 from public.normalization_schedules where id=sch),'schedule cascade preserved';
 assert not exists(select 1 from public.normalized_allocations where schedule_id=sch),'allocation cascade preserved';
 -- Outsider denial is checked separately from same-owner cross-household integrity.
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 assert not exists(select 1 from public.transactions where household_id=h),'outsider cannot read';
 failed:=false;begin perform public.close_month(h,'2001-01-01');exception when raise_exception then failed:=true;end;assert failed,'outsider cannot close';
 failed:=false;begin perform public.reopen_month(h,'2001-01-01');exception when raise_exception then failed:=true;end;assert failed,'outsider cannot reopen';
 execute 'reset role';
end $test$;
select 'PASS: household references, immutable ownership, FK actions, closed cash and normalized periods, reopening, cascades and outsider denial' as result;
rollback;
