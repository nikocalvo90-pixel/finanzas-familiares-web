create table public.shopping_items (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id),
 name text not null check(length(btrim(name)) between 1 and 120),
 quantity text not null default '' check(length(quantity)<=80),
 note text not null default '' check(length(note)<=500),
 section text not null default 'Otros' check(section in ('Fruta y verdura','Carne y pescado','Lácteos y huevos','Pan y cereales','Despensa','Congelados','Bebidas','Limpieza e higiene','Bebé','Otros')),
 favorite boolean not null default false,
 purchased boolean not null default false,
 archived boolean not null default false,
 created_by uuid not null default auth.uid(),
 updated_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default clock_timestamp()
);
create unique index shopping_items_household_name on public.shopping_items(household_id,lower(btrim(name)));
alter table public.shopping_items enable row level security;
revoke all on public.shopping_items from public,anon,authenticated;
grant select,insert,update on public.shopping_items to authenticated;
create policy shopping_select on public.shopping_items for select to authenticated using(public.is_household_member(household_id));
create policy shopping_insert on public.shopping_items for insert to authenticated with check(public.is_household_member(household_id));
create policy shopping_update on public.shopping_items for update to authenticated using(public.is_household_member(household_id)) with check(public.is_household_member(household_id));
create function public.validate_shopping_item() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.is_household_member(new.household_id) then raise exception 'Acceso denegado'; end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.household_id<>old.household_id then raise exception 'No se puede mover el producto a otro hogar'; end if;
  new.created_at:=old.created_at;new.created_by:=old.created_by;
 else new.created_at:=clock_timestamp();new.created_by:=auth.uid();end if;
 new.name:=regexp_replace(btrim(new.name),'\s+',' ','g');
 new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function public.validate_shopping_item() from public,anon,authenticated;
create trigger shopping_validate before insert or update on public.shopping_items for each row execute function public.validate_shopping_item();
create trigger shopping_audit after insert or update on public.shopping_items for each row execute function public.audit_household_entity_change();
notify pgrst,'reload schema';
