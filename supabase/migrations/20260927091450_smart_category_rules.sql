-- Additive upgrade: no historical movement is reclassified or used for backfill.
create function public.normalize_rule_text(p_text text)
returns text language sql immutable strict set search_path = public
as $$
  select btrim(regexp_replace(regexp_replace(lower(regexp_replace(
    normalize(p_text,NFD),U&'[\0300-\036f]','','g')),'[^a-z0-9 ]',' ','g'),' +',' ','g'));
$$;
revoke all on function public.normalize_rule_text(text) from public,anon;
grant execute on function public.normalize_rule_text(text) to authenticated;

create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pattern text not null check (char_length(pattern) between 2 and 300 and pattern ~ '[a-z]'),
  match_mode text not null default 'EXACT' check (match_mode in ('EXACT','WORDS')),
  transaction_type public.transaction_type not null,
  category_id uuid not null references public.categories(id),
  active boolean not null default true,
  origin text not null default 'MANUAL' check (origin in ('MANUAL','LEARNED')),
  confirmations integer not null default 0 check (confirmations >= 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(household_id,transaction_type,match_mode,pattern)
);
create index category_rules_category_idx on public.category_rules(category_id);
alter table public.category_rules enable row level security;
revoke all on public.category_rules from public,anon,authenticated;
grant select,insert,update on public.category_rules to authenticated;
create policy category_rules_select on public.category_rules for select to authenticated
  using (public.is_household_member(household_id));
create policy category_rules_insert on public.category_rules for insert to authenticated
  with check (public.is_household_member(household_id));
create policy category_rules_update on public.category_rules for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create function public.validate_category_rule()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_household_member(new.household_id) then
    raise exception 'No tienes acceso a las reglas de este hogar.';
  end if;
  if tg_op='UPDATE' then
    if new.household_id<>old.household_id then raise exception 'No se puede cambiar el hogar de una regla.'; end if;
    new.created_by:=old.created_by; new.created_at:=old.created_at;
  else new.created_by:=auth.uid();
  end if;
  new.pattern:=public.normalize_rule_text(new.pattern);
  if not exists(select 1 from public.categories c where c.id=new.category_id
    and c.household_id=new.household_id and c.kind=new.transaction_type
    and (not new.active or not c.is_archived)) then
    raise exception 'Elige una categoría activa del hogar que corresponda al tipo de movimiento.';
  end if;
  new.updated_by:=auth.uid(); new.updated_at:=clock_timestamp();
  return new;
end;
$$;
revoke all on function public.validate_category_rule() from public,anon,authenticated;
create trigger category_rules_validate before insert or update on public.category_rules
  for each row execute function public.validate_category_rule();
create trigger category_rules_audit after insert or update on public.category_rules
  for each row execute function public.audit_household_entity_change();

alter table public.transactions add column learn_category boolean not null default false;
create function public.learn_transaction_category()
returns trigger language plpgsql security invoker set search_path = public
as $$
declare v_pattern text;
begin
  if not new.learn_category or not new.classification_confirmed or new.category_id is null then return new; end if;
  if tg_op='UPDATE' then
    if old.learn_category and old.category_id is not distinct from new.category_id
      and old.type=new.type and old.concept=new.concept then return new; end if;
  end if;
  v_pattern:=public.normalize_rule_text(new.concept);
  if char_length(v_pattern) not between 2 and 300 or v_pattern !~ '[a-z]' then return new; end if;
  insert into public.category_rules(household_id,pattern,match_mode,transaction_type,category_id,origin,confirmations)
    values(new.household_id,v_pattern,'EXACT',new.type,new.category_id,'LEARNED',1)
    on conflict(household_id,transaction_type,match_mode,pattern) do update
      set category_id=excluded.category_id,confirmations=category_rules.confirmations+1
      -- A paused rule stays paused even when the same correction is confirmed again.
      where category_rules.active;
  return new;
end;
$$;
revoke all on function public.learn_transaction_category() from public,anon,authenticated;
create trigger transactions_learn_category after insert or update on public.transactions
  for each row execute function public.learn_transaction_category();

CREATE OR REPLACE FUNCTION public.import_bank_transactions(p_household uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_row jsonb;
  v_date date;
  v_amount numeric;
  v_type public.transaction_type;
  v_concept text;
  v_account uuid;
  v_destination uuid;
  v_investment uuid;
  v_category uuid;
  v_person uuid;
  v_external_id text;
  v_inserted_id uuid;
  v_inserted integer := 0;
  v_skipped integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_household_member(p_household) then
    raise exception 'Access denied';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'La importación debe contener una lista de movimientos.';
  end if;

  if jsonb_array_length(p_rows) > 500 then
    raise exception 'Puedes importar un máximo de 500 movimientos por lote.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    where coalesce((r->>'learn_category')::boolean,false) and nullif(r->>'category_id','') is not null
    group by public.normalize_rule_text(r->>'concept'),r->>'type'
    having count(distinct r->>'category_id')>1
  ) then raise exception 'Hay categorías distintas para el mismo concepto. Desmarca Recordar en esas filas.'; end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    begin
      v_date := nullif(v_row->>'transaction_date','')::date;
      v_amount := nullif(v_row->>'amount','')::numeric;
      v_type := nullif(v_row->>'type','')::public.transaction_type;
      v_concept := nullif(trim(coalesce(v_row->>'concept','')),'');
      v_account := nullif(v_row->>'account_id','')::uuid;
      v_destination := nullif(v_row->>'destination_account_id','')::uuid;
      v_investment := nullif(v_row->>'investment_id','')::uuid;
      v_category := nullif(v_row->>'category_id','')::uuid;
      v_person := nullif(v_row->>'person_user_id','')::uuid;
      v_external_id := nullif(trim(coalesce(v_row->>'external_id','')),'');
    exception when others then
      raise exception 'Hay una fila importada con datos inválidos.';
    end;

    if v_date is null or v_amount is null or v_amount <= 0 or v_type is null or v_concept is null then
      raise exception 'Cada fila necesita fecha, importe mayor que cero, tipo y concepto.';
    end if;

    if v_external_id is null then
      raise exception 'Cada fila importada necesita un identificador externo.';
    end if;

    if v_account is null or not exists (
      select 1 from public.accounts
      where id=v_account and household_id=p_household and not is_archived
    ) then
      raise exception 'La cuenta de una fila no pertenece al hogar o está archivada.';
    end if;

    if v_category is not null and not exists (
      select 1 from public.categories
      where id=v_category and household_id=p_household and not is_archived
    ) then
      raise exception 'La categoría de una fila no pertenece al hogar o está archivada.';
    end if;

    if v_person is not null and not exists (
      select 1 from public.household_members
      where household_id=p_household and user_id=v_person
    ) then
      raise exception 'La persona de una fila no pertenece al hogar.';
    end if;

    if v_type='TRANSFERENCIA_INTERNA' then
      if v_destination is null or v_destination=v_account or not exists (
        select 1 from public.accounts
        where id=v_destination and household_id=p_household and not is_archived
      ) then
        raise exception 'Una transferencia importada necesita una cuenta destino activa y distinta.';
      end if;
    else
      v_destination := null;
    end if;

    if v_type in ('INVERSION','RETIRADA_INVERSION') then
      if v_investment is null or not exists (
        select 1 from public.investments
        where id=v_investment and household_id=p_household and not is_archived
      ) then
        raise exception 'Un movimiento de inversión importado necesita una inversión activa del hogar.';
      end if;
    else
      v_investment := null;
    end if;

    v_inserted_id := null;
    insert into public.transactions(
      household_id, transaction_date, amount, type, concept, category_id,
      person_user_id, person_label, account_id, destination_account_id,
      investment_id, notes, source, external_id, created_by, raw_input,
      classification_confidence, classification_reason, classification_confirmed, learn_category
    )
    values(
      p_household,
      v_date,
      v_amount,
      v_type,
      v_concept,
      v_category,
      v_person,
      nullif(trim(coalesce(v_row->>'person_label','')),''),
      v_account,
      v_destination,
      v_investment,
      nullif(trim(coalesce(v_row->>'notes','')),''),
      'BANK_CSV',
      v_external_id,
      (select auth.uid()),
      v_row->>'raw_input',
      nullif(v_row->>'classification_confidence','')::numeric,
      nullif(trim(coalesce(v_row->>'classification_reason','')),''),
      coalesce((v_row->>'classification_confirmed')::boolean,false),
      coalesce((v_row->>'learn_category')::boolean,false)
    )
    on conflict (household_id,external_id) where external_id is not null
    do nothing
    returning id into v_inserted_id;

    if v_inserted_id is null then
      v_skipped := v_skipped + 1;
    else
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'inserted_count',v_inserted,
    'skipped_existing_count',v_skipped,
    'total_count',jsonb_array_length(p_rows)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.transaction_sync_state(p_household uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'category_rules_count',(select count(*) from public.category_rules where household_id=p_household),
    'category_rules_updated',(select coalesce(max(updated_at)::text,'') from public.category_rules where household_id=p_household),
    'transactions_count',(select count(*) from public.transactions where household_id=p_household),
    'transactions_updated',(select coalesce(max(updated_at)::text,'') from public.transactions where household_id=p_household),
    'recurring_count',(select count(*) from public.recurring_rules where household_id=p_household),
    'recurring_updated',(select coalesce(max(updated_at)::text,'') from public.recurring_rules where household_id=p_household),
    'accounts_count',(select count(*) from public.accounts where household_id=p_household),
    'accounts_updated',(select coalesce(max(updated_at)::text,'') from public.accounts where household_id=p_household),
    'investments_count',(select count(*) from public.investments where household_id=p_household),
    'investments_updated',(select coalesce(max(updated_at)::text,'') from public.investments where household_id=p_household),
    'assets_count',(select count(*) from public.assets where household_id=p_household),
    'assets_updated',(select coalesce(max(updated_at)::text,'') from public.assets where household_id=p_household),
    'liabilities_count',(select count(*) from public.liabilities where household_id=p_household),
    'liabilities_updated',(select coalesce(max(updated_at)::text,'') from public.liabilities where household_id=p_household),
    'tasks_count',(select count(*) from public.family_tasks where household_id=p_household),
    'tasks_updated',(select coalesce(max(updated_at)::text,'') from public.family_tasks where household_id=p_household),
    'reconciliations_count',(select count(*) from public.reconciliations where household_id=p_household),
    'reconciliations_updated',(select coalesce(max(created_at)::text,'') from public.reconciliations where household_id=p_household),
    'goals_count',(select count(*) from public.savings_goals where household_id=p_household),
    'goals_updated',(select coalesce(max(updated_at)::text,'') from public.savings_goals where household_id=p_household),
    'notifications_count',(select count(*) from public.notification_events where household_id=p_household),
    'notifications_updated',(select coalesce(max(greatest(created_at,coalesce(read_at,created_at),coalesce(dismissed_at,created_at)))::text,'') from public.notification_events where household_id=p_household),
    'notification_preferences_updated',(select coalesce(max(updated_at)::text,'') from public.notification_preferences where household_id=p_household)
  );
$function$;

notify pgrst,'reload schema';
