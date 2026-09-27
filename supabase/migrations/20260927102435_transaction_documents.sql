-- Private attachments. Metadata first, immutable upload, then verified READY state.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('finanzas-documents','finanzas-documents',false,10485760,
  array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']);

create table public.transaction_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  transaction_id uuid references public.transactions(id) on delete set null,
  transaction_label text not null,
  transaction_date date not null,
  filename text not null check(char_length(filename) between 1 and 180),
  mime_type text not null,
  extension text not null,
  size_bytes bigint not null check(size_bytes between 1 and 10485760),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  object_path text generated always as (household_id::text||'/'||id::text||'.'||extension) stored unique,
  status text not null default 'PENDING' check(status in ('PENDING','READY')),
  archived boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(household_id,transaction_id,sha256),
  check ((mime_type='application/pdf' and extension='pdf') or
    (mime_type='image/jpeg' and extension='jpg') or
    (mime_type='image/png' and extension='png') or
    (mime_type='image/webp' and extension='webp') or
    (mime_type='image/heic' and extension='heic') or
    (mime_type='image/heif' and extension='heif'))
);
create index transaction_documents_transaction_idx on public.transaction_documents(transaction_id);
alter table public.transaction_documents enable row level security;
revoke all on public.transaction_documents from public,anon,authenticated;
grant select,insert,update on public.transaction_documents to authenticated;
create policy documents_select on public.transaction_documents for select to authenticated
  using(public.is_household_member(household_id));
create policy documents_insert on public.transaction_documents for insert to authenticated
  with check(public.is_household_member(household_id));
create policy documents_update on public.transaction_documents for update to authenticated
  using(public.is_household_member(household_id)) with check(public.is_household_member(household_id));

create policy finance_documents_read on storage.objects for select to authenticated
using(bucket_id='finanzas-documents' and exists(
  select 1 from public.transaction_documents d where d.object_path=name and public.is_household_member(d.household_id)));
create policy finance_documents_upload on storage.objects for insert to authenticated
with check(bucket_id='finanzas-documents' and exists(
  select 1 from public.transaction_documents d where d.object_path=name and d.status='PENDING'
    and not d.archived and d.transaction_id is not null and public.is_household_member(d.household_id)));
-- No UPDATE/DELETE policy: originals cannot be overwritten or permanently deleted by clients.

create function public.validate_transaction_document()
returns trigger language plpgsql security invoker set search_path=public
as $$
declare tx public.transactions; expected_path text;
begin
  if auth.uid() is null or not public.is_household_member(new.household_id) then
    raise exception 'No tienes acceso a los documentos de este hogar.';
  end if;
  if tg_op='INSERT' then
    select * into tx from public.transactions where id=new.transaction_id and household_id=new.household_id;
    if not found then raise exception 'El movimiento no pertenece al hogar o ya no existe.'; end if;
    new.transaction_label:=tx.concept; new.transaction_date:=tx.transaction_date;
    new.created_by:=auth.uid();new.created_at:=now();new.status:='PENDING';new.archived:=false;
  else
    if new.id<>old.id or new.household_id<>old.household_id or new.filename<>old.filename
      or new.mime_type<>old.mime_type or new.extension<>old.extension or new.size_bytes<>old.size_bytes
      or new.sha256<>old.sha256 then raise exception 'El archivo original no se puede sustituir.'; end if;
    new.created_by:=old.created_by;new.created_at:=old.created_at;
    new.transaction_label:=old.transaction_label;new.transaction_date:=old.transaction_date;
    if new.transaction_id is distinct from old.transaction_id then
      if new.transaction_id is null and not exists(select 1 from public.transactions where id=old.transaction_id) then
        new.archived:=true;
      else raise exception 'No se puede mover el documento a otro movimiento.'; end if;
    end if;
    if new.transaction_id is null and not new.archived then raise exception 'El movimiento fue eliminado. El documento permanece en Retirados.'; end if;
    if old.status='READY' and new.status<>'READY' then raise exception 'Un documento guardado no puede volver a pendiente.'; end if;
    if new.status='READY' and old.status='PENDING' then
      expected_path:=new.household_id::text||'/'||new.id::text||'.'||new.extension;
      if not exists(select 1 from storage.objects o where o.bucket_id='finanzas-documents'
        and o.name=expected_path and (o.metadata->>'size')::bigint=new.size_bytes
        and o.metadata->>'mimetype'=new.mime_type) then
        raise exception 'El archivo aún no se ha recibido completo. Vuelve a seleccionar el mismo archivo para reintentar.';
      end if;
    end if;
  end if;
  new.updated_at:=clock_timestamp();return new;
end;
$$;
revoke all on function public.validate_transaction_document() from public,anon,authenticated;
create trigger documents_validate before insert or update on public.transaction_documents
  for each row execute function public.validate_transaction_document();
create trigger documents_audit after insert or update on public.transaction_documents
  for each row execute function public.audit_household_entity_change();

CREATE OR REPLACE FUNCTION public.transaction_sync_state(p_household uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'documents_count',(select count(*) from public.transaction_documents where household_id=p_household),
    'documents_updated',(select coalesce(max(updated_at)::text,'') from public.transaction_documents where household_id=p_household),
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
