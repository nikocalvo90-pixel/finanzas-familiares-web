-- Keep every financial reference inside its household, including callers that
-- bypass the UI. Replace (rather than duplicate) FKs for PostgREST embeds.
do $migration$
declare f record; action text;
begin
 for f in
  select k.conrelid::regclass child,k.confrelid::regclass parent,k.conname,
   c.relname parent_name,a.attname column_name,k.confdeltype
  from pg_constraint k join pg_class c on c.oid=k.confrelid
  join pg_namespace cn on cn.oid=c.relnamespace
  join pg_class child on child.oid=k.conrelid
  join pg_namespace n on n.oid=child.relnamespace
  join pg_attribute a on a.attrelid=k.conrelid and a.attnum=k.conkey[1]
  where k.contype='f' and cardinality(k.conkey)=1 and n.nspname='public' and cn.nspname='public'
   and exists(select 1 from pg_attribute where attrelid=k.conrelid and attname='household_id' and not attisdropped)
   and exists(select 1 from pg_attribute where attrelid=k.confrelid and attname='household_id' and not attisdropped)
 loop
  if not exists(select 1 from pg_constraint where conrelid=f.parent and conname=f.parent_name||'_household_id_id_key') then
   execute format('alter table %s add constraint %I unique (household_id,id)',f.parent,f.parent_name||'_household_id_id_key');
  end if;
  action:=case f.confdeltype when 'c' then ' on delete cascade' when 'n' then format(' on delete set null (%I)',f.column_name) when 'r' then ' on delete restrict' when 'a' then ' on delete no action' else null end;
  if action is null then raise exception 'Unsupported FK delete action: %',f.conname;end if;
  execute format('alter table %s drop constraint %I, add constraint %I foreign key (household_id,%I) references %s (household_id,id)%s',f.child,f.conname,f.conname,f.column_name,f.parent,action);
  execute format('create index if not exists %I on %s (household_id,%I)','hh_ref_'||md5(f.child::text||'.'||f.column_name),f.child,f.column_name);
 end loop;
end $migration$;

create or replace function public.enforce_household_identity()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.household_id is distinct from old.household_id or to_jsonb(new)->'id' is distinct from to_jsonb(old)->'id' then
  raise exception 'No se puede cambiar el hogar ni el identificador de un registro' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.enforce_household_identity() from public,anon,authenticated;
do $$
declare t record;
begin
 for t in select c.oid::regclass tbl from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and exists(select 1 from pg_attribute where attrelid=c.oid and attname='household_id' and not attisdropped)
 loop
  execute format('create trigger household_identity_guard before update on %s for each row execute function public.enforce_household_identity()',t.tbl);
 end loop;
end $$;

-- These relationships have no household column/composite FK of their own.
create or replace function public.enforce_transaction_tag_household()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.transactions t join public.tags g on g.household_id=t.household_id where t.id=new.transaction_id and g.id=new.tag_id) then
  raise exception 'El movimiento y la etiqueta deben pertenecer al mismo hogar' using errcode='23503';
 end if;
 return new;
end $$;
revoke all on function public.enforce_transaction_tag_household() from public,anon,authenticated;
create trigger transaction_tags_household_guard before insert or update on public.transaction_tags for each row execute function public.enforce_transaction_tag_household();

create or replace function public.enforce_reconciliation_household()
returns trigger language plpgsql security invoker set search_path='' as $$
declare valid boolean;
begin
 -- An unchanged historical reconciliation may outlive an archived/deleted entity.
 if tg_op='UPDATE' and new.entity_type=old.entity_type and new.entity_id=old.entity_id and new.household_id=old.household_id then return new;end if;
 case new.entity_type
  when 'CUENTA' then select exists(select 1 from public.accounts where id=new.entity_id and household_id=new.household_id) into valid;
  when 'INVERSION' then select exists(select 1 from public.investments where id=new.entity_id and household_id=new.household_id) into valid;
  when 'ACTIVO' then select exists(select 1 from public.assets where id=new.entity_id and household_id=new.household_id) into valid;
  when 'DEUDA' then select exists(select 1 from public.liabilities where id=new.entity_id and household_id=new.household_id) into valid;
  else valid:=false;
 end case;
 if not valid then raise exception 'La conciliación debe referirse a un elemento del mismo hogar' using errcode='23503';end if;
 return new;
end $$;
revoke all on function public.enforce_reconciliation_household() from public,anon,authenticated;
create trigger reconciliations_household_guard before insert or update on public.reconciliations for each row execute function public.enforce_reconciliation_household();

-- Check OLD and NEW, plus all normalized periods affected by the operation.
-- The same household lock is held by close/reopen, serializing concurrent writes.
create or replace function public.enforce_open_month()
returns trigger language plpgsql security invoker set search_path='' as $$
declare rows jsonb:='[]';r jsonb;h uuid;d date;closed_month date;
begin
 if tg_op<>'INSERT' then rows:=rows||jsonb_build_array(to_jsonb(old));end if;
 if tg_op<>'DELETE' then rows:=rows||jsonb_build_array(to_jsonb(new));end if;
 for r in select value from jsonb_array_elements(rows) loop
  h:=(r->>'household_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('ff:financial:'||h::text,0));
  closed_month:=null;d:=null;
  if tg_table_name='transactions' then
   d:=(r->>'transaction_date')::date;
   select c.month into closed_month from public.monthly_closures c
    join public.normalized_allocations a on a.household_id=c.household_id and a.period_month=c.month
    join public.normalization_schedules s on s.id=a.schedule_id and s.active
    where c.household_id=h and c.status='CLOSED' and s.transaction_id=(r->>'id')::uuid limit 1;
  elsif tg_table_name='normalization_schedules' then
   select t.transaction_date into d from public.transactions t where t.id=(r->>'transaction_id')::uuid and t.household_id=h;
   if (r->>'active')::boolean then
    select c.month into closed_month from public.monthly_closures c
     where c.household_id=h and c.status='CLOSED' and (
      c.month between (r->>'start_month')::date and ((r->>'start_month')::date+make_interval(months=>(r->>'months_count')::integer-1))::date
      or exists(select 1 from public.normalized_allocations a where a.schedule_id=(r->>'id')::uuid and a.period_month=c.month)) limit 1;
   end if;
  elsif tg_table_name='normalized_allocations' then
   d:=(r->>'period_month')::date;
   select c.month into closed_month from public.monthly_closures c
    join public.transactions t on t.household_id=c.household_id and date_trunc('month',t.transaction_date)::date=c.month
    join public.normalization_schedules s on s.transaction_id=t.id
    where c.household_id=h and c.status='CLOSED' and s.id=(r->>'schedule_id')::uuid limit 1;
  end if;
  if closed_month is null then
   select c.month into closed_month from public.monthly_closures c where c.household_id=h and c.status='CLOSED' and c.month=date_trunc('month',d)::date;
  end if;
  if closed_month is not null then
   raise exception 'El mes % está cerrado. El propietario debe reabrirlo antes de modificar sus movimientos o periodizaciones.',to_char(closed_month,'YYYY-MM') using errcode='23514';
  end if;
 end loop;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function public.enforce_open_month() from public,anon,authenticated;
create trigger normalization_schedules_open_month_guard before insert or update or delete on public.normalization_schedules for each row execute function public.enforce_open_month();
create trigger normalized_allocations_open_month_guard before insert or update or delete on public.normalized_allocations for each row execute function public.enforce_open_month();

-- Existing owner-only RPCs retain their authority to write monthly_closures.
create or replace function public.close_month(p_household uuid,p_month date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_month date:=date_trunc('month',p_month)::date;v_metrics jsonb;v_today date;
begin
 if not public.is_household_owner(p_household) then raise exception 'Solo el propietario puede cerrar meses';end if;
 if p_month is null then raise exception 'Selecciona un mes';end if;
 perform pg_advisory_xact_lock(hashtextextended('ff:financial:'||p_household::text,0));
 select (now() at time zone h.timezone)::date into v_today from public.households h where h.id=p_household;
 if v_month>(date_trunc('month',v_today))::date or v_today<(v_month+interval '1 month - 1 day')::date then raise exception 'El mes se puede cerrar a partir de su último día';end if;
 select to_jsonb(m) into v_metrics from public.monthly_metrics(p_household,v_month) m;
 insert into public.monthly_closures(household_id,month,status,snapshot,closed_by,closed_at,reopened_by,reopened_at)
 values(p_household,v_month,'CLOSED',coalesce(v_metrics,'{}'::jsonb),auth.uid(),now(),null,null)
 on conflict(household_id,month) do update set status='CLOSED',snapshot=excluded.snapshot,closed_by=excluded.closed_by,closed_at=excluded.closed_at,reopened_by=null,reopened_at=null;
 return v_metrics;
end $$;
create or replace function public.reopen_month(p_household uuid,p_month date)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_household_owner(p_household) then raise exception 'Solo el propietario puede reabrir meses';end if;
 perform pg_advisory_xact_lock(hashtextextended('ff:financial:'||p_household::text,0));
 update public.monthly_closures set status='REOPENED',reopened_by=auth.uid(),reopened_at=now() where household_id=p_household and month=date_trunc('month',p_month)::date;
end $$;
revoke all on function public.close_month(uuid,date),public.reopen_month(uuid,date) from public,anon;
grant execute on function public.close_month(uuid,date),public.reopen_month(uuid,date) to authenticated;

-- Backup validation understands both single and household-scoped foreign keys.
CREATE OR REPLACE FUNCTION public.restore_household_backup(p_household uuid, p_data jsonb, p_apply boolean DEFAULT false, p_expected text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 tables text[]:=array['categories','accounts','assets','investments','liabilities','payees','tags','recurring_rules','transactions','normalization_schedules','account_balance_snapshots','investment_valuations','asset_valuations','liability_snapshots','liability_balance_snapshots','net_worth_snapshots','reconciliations','family_tasks','savings_goals','budgets','category_rules','shopping_items','transaction_documents','monthly_closures','transaction_tags'];
 ignored text[]:=array['created_at','updated_at','created_by','updated_by','learn_category','object_path'];
 tab text;rowdata jsonb;oldrow jsonb;clean jsonb;colnames text;selectnames text;fk record;allowed boolean;stat jsonb:='{}';conflicts jsonb:='[]';uploads jsonb:='[]';added integer:=0;kept integer:=0;total integer:=0;token text;statejson jsonb;result jsonb;object_exists boolean;rid uuid;processed integer;
begin
 p_apply:=coalesce(p_apply,false);
 if auth.uid() is null or not public.is_household_owner(p_household) then raise exception 'Solo el propietario puede restaurar una copia del hogar';end if;
 if jsonb_typeof(p_data)<>'object' or p_data#>>'{households,0,id}' is distinct from p_household::text then raise exception 'La copia pertenece a otro hogar';end if;
 if octet_length(p_data::text)>20971520 then raise exception 'Los datos superan 20 MB';end if;
 token:=md5(p_data::text);
 foreach tab in array tables loop
  if p_data ? tab and jsonb_typeof(p_data->tab)<>'array' then raise exception 'Tabla no válida: %',tab;end if;
  if tab<>'transaction_tags' and (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(coalesce(p_data->tab,'[]'))) then raise exception 'Identificadores duplicados o ausentes en %',tab;end if;
  total:=total+jsonb_array_length(coalesce(p_data->tab,'[]'));
  if tab='transaction_tags' then
   select coalesce(jsonb_agg(to_jsonb(t) order by t.transaction_id,t.tag_id),'[]') into statejson from public.transaction_tags t join public.transactions x on x.id=t.transaction_id where x.household_id=p_household;
  else execute format('select coalesce(jsonb_agg(to_jsonb(t) order by id),''[]'') from public.%I t where household_id=$1',tab) into statejson using p_household;end if;
  token:=md5(token||statejson::text);
 end loop;
 if total>20000 then raise exception 'La copia supera 20000 registros';end if;
 select coalesce(jsonb_agg(jsonb_build_array(o.name,o.metadata) order by o.name),'[]') into statejson from storage.objects o join public.transaction_documents d on d.object_path=o.name where o.bucket_id='finanzas-documents' and d.household_id=p_household;
 token:=md5(token||statejson::text);
 if p_apply and p_expected is distinct from token then return jsonb_build_object('ok',false,'error','Los datos cambiaron. Vuelve a analizar la copia.');end if;
 begin
 foreach tab in array tables loop
  added:=0;kept:=0;processed:=0;
  for rowdata in
   with recursive ordered(data,depth) as (
    select e.value,0 from jsonb_array_elements(coalesce(p_data->tab,'[]')) e
    where tab not in ('transactions','family_tasks') or e.value->>(case when tab='transactions' then 'reimburses_transaction_id' else 'generated_from_task_id' end) is null
      or not exists(select 1 from jsonb_array_elements(coalesce(p_data->tab,'[]')) parent where parent.value->>'id'=e.value->>(case when tab='transactions' then 'reimburses_transaction_id' else 'generated_from_task_id' end))
    union all
    select child.value,o.depth+1 from ordered o cross join jsonb_array_elements(coalesce(p_data->tab,'[]')) child
    where tab in ('transactions','family_tasks') and child.value->>(case when tab='transactions' then 'reimburses_transaction_id' else 'generated_from_task_id' end)=o.data->>'id' and o.depth<1000
   ) select data from ordered order by depth,data->>'created_at',data->>'id'
  loop
   processed:=processed+1;
   if jsonb_typeof(rowdata)<>'object' then raise exception 'Registro no válido';end if;
   if tab='transaction_tags' then
    if not exists(select 1 from public.transactions where id=(rowdata->>'transaction_id')::uuid and household_id=p_household) or not exists(select 1 from public.tags where id=(rowdata->>'tag_id')::uuid and household_id=p_household) then raise exception 'Etiqueta fuera del hogar o movimiento ausente';end if;
    if exists(select 1 from public.transaction_tags where transaction_id=(rowdata->>'transaction_id')::uuid and tag_id=(rowdata->>'tag_id')::uuid) then kept:=kept+1;else insert into public.transaction_tags(transaction_id,tag_id) values((rowdata->>'transaction_id')::uuid,(rowdata->>'tag_id')::uuid);added:=added+1;end if;
    continue;
   end if;
   if rowdata->>'household_id' is distinct from p_household::text then raise exception 'Registro de otro hogar en %',tab;end if;
   rid:=(rowdata->>'id')::uuid;if rid is null then raise exception 'Falta identificador';end if;
   execute format('select to_jsonb(t) from public.%I t where id=$1 and household_id=$2',tab) into oldrow using rid,p_household;
   if oldrow is not null then
    if (oldrow-ignored-(case when tab='transaction_documents' then array['status','transaction_label','transaction_date'] else array[]::text[] end)) is distinct from (rowdata-ignored-(case when tab='transaction_documents' then array['status','transaction_label','transaction_date'] else array[]::text[] end)) then
     conflicts:=conflicts||jsonb_build_array(jsonb_build_object('table',tab,'id',rid,'label',coalesce(rowdata->>'name',rowdata->>'concept',rowdata->>'filename',rowdata->>'title',rid::text)));
     continue;
    end if;
    kept:=kept+1;
   else
    clean:=rowdata-'object_path';
    if clean ? 'created_by' then clean:=jsonb_set(clean,'{created_by}',to_jsonb(auth.uid()));end if;
    if clean ? 'updated_by' then clean:=jsonb_set(clean,'{updated_by}',to_jsonb(auth.uid()));end if;
    if tab='transactions' then clean:=jsonb_set(clean,'{learn_category}','false');end if;
    if tab='recurring_rules' then clean:=clean||'{"active":false,"auto_post":false}'::jsonb;end if;
    if tab='transaction_documents' then clean:=clean||'{"status":"PENDING"}'::jsonb;end if;
    for fk in
     select a.attname as column_name,ns.nspname as target_schema,c.relname as target_table,ta.attname as target_column
     from pg_constraint k cross join lateral unnest(k.conkey,k.confkey) as key_pair(child_attnum,parent_attnum)
     join pg_attribute a on a.attrelid=k.conrelid and a.attnum=key_pair.child_attnum
     join pg_class c on c.oid=k.confrelid join pg_namespace ns on ns.oid=c.relnamespace
     join pg_attribute ta on ta.attrelid=k.confrelid and ta.attnum=key_pair.parent_attnum
     where k.conrelid=('public.'||tab)::regclass and k.contype='f' and ns.nspname='public' and c.relname<>'households' and a.attname<>'household_id'
    loop
     if clean->>fk.column_name is not null then
      execute format('select exists(select 1 from %I.%I where %I=$1 and household_id=$2)',fk.target_schema,fk.target_table,fk.target_column) into allowed using (clean->>fk.column_name)::uuid,p_household;
      if not allowed then raise exception 'Referencia ausente o ajena al hogar en %.%',tab,fk.column_name;end if;
     end if;
    end loop;
    select string_agg(format('%I',a.attname),',' order by a.attnum),string_agg(format('r.%I',a.attname),',' order by a.attnum) into colnames,selectnames
      from pg_attribute a where a.attrelid=('public.'||tab)::regclass and a.attnum>0 and not a.attisdropped and a.attgenerated='' and clean ? a.attname;
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r',tab,colnames,selectnames,tab) using clean;
    added:=added+1;
   end if;
   if tab='transaction_documents' and rowdata->>'status'='READY' then
    select exists(select 1 from storage.objects o join public.transaction_documents d on d.object_path=o.name where d.id=rid and o.bucket_id='finanzas-documents') into object_exists;
    if not object_exists then
     update public.transaction_documents set status='PENDING' where id=rid;
     uploads:=uploads||jsonb_build_array(jsonb_build_object('id',rid,'archived',(rowdata->>'archived')::boolean));
    else update public.transaction_documents set status='READY' where id=rid and status='PENDING';end if;
   end if;
  end loop;
  if processed<>jsonb_array_length(coalesce(p_data->tab,'[]')) then raise exception 'Referencias circulares o cadena demasiado larga en %',tab;end if;
  stat:=stat||jsonb_build_object(tab,jsonb_build_object('add',added,'existing',kept));
 end loop;
 result:=jsonb_build_object('ok',true,'applied',p_apply,'token',token,'tables',stat,'conflicts',conflicts,'documents',uploads);
 if not p_apply then raise exception using errcode='ZX001',message='preview rollback';end if;
 exception when sqlstate 'ZX001' then null;
 when others then result:=jsonb_build_object('ok',false,'error',format('No se ha restaurado ningún dato. %s: %s',tab,sqlerrm));
 end;
 return result;
end $function$;

revoke all on function public.restore_household_backup(uuid,jsonb,boolean,text) from public,anon;
grant execute on function public.restore_household_backup(uuid,jsonb,boolean,text) to authenticated;
-- Atomic deployment check, mirrored in supabase/tests/household_integrity.sql.
-- Success rolls back its synthetic fixtures; an assertion failure aborts migration.
do $test$
declare u uuid;h uuid;other_h uuid;a uuid:=gen_random_uuid();other_a uuid:=gen_random_uuid();
 tx uuid:=gen_random_uuid();open_tx uuid:=gen_random_uuid();sch uuid:=gen_random_uuid();other_sch uuid:=gen_random_uuid();
 tag uuid:=gen_random_uuid();other_tag uuid:=gen_random_uuid();cat uuid;other_cat uuid;failed boolean;m jsonb;
begin
 begin
 select user_id into u from public.household_members where role='OWNER' order by joined_at limit 1;
 if u is null then return;end if; -- Empty installations have no authenticated fixture yet.
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
 raise exception using errcode='ZX002',message='Integrity test succeeded; roll back only synthetic fixtures';
 exception when sqlstate 'ZX002' then null;
 end;
end $test$;

notify pgrst,'reload schema';
