create or replace function public.restore_household_backup(p_household uuid,p_data jsonb,p_apply boolean default false,p_expected text default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
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
     from pg_constraint k join pg_attribute a on a.attrelid=k.conrelid and a.attnum=k.conkey[1]
     join pg_class c on c.oid=k.confrelid join pg_namespace ns on ns.oid=c.relnamespace
     join pg_attribute ta on ta.attrelid=k.confrelid and ta.attnum=k.confkey[1]
     where k.conrelid=('public.'||tab)::regclass and k.contype='f' and ns.nspname='public' and c.relname<>'households'
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
end $$;
revoke all on function public.restore_household_backup(uuid,jsonb,boolean,text) from public,anon;
grant execute on function public.restore_household_backup(uuid,jsonb,boolean,text) to authenticated;

notify pgrst,'reload schema';
