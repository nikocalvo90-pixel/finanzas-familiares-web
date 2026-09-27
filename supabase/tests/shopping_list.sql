begin;
do $$
declare h uuid;u uuid;v uuid;
begin
 select household_id,user_id into h,u from public.household_members order by joined_at limit 1;
 select user_id into v from public.household_members where household_id=h and user_id<>u limit 1;
 assert h is not null and v is not null,'needs two members';
 perform set_config('test.shop_h',h::text,true);perform set_config('test.shop_u',u::text,true);perform set_config('test.shop_v',v::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);
end $$;
set local role authenticated;
do $$
declare h uuid:=current_setting('test.shop_h')::uuid;u uuid:=current_setting('test.shop_u')::uuid;v uuid:=current_setting('test.shop_v')::uuid;i uuid;n text:='Synthetic shopping '||gen_random_uuid();failed boolean;oldtime timestamptz;
begin
 insert into public.shopping_items(household_id,name,quantity,favorite) values(h,n,'2 unidades',true) returning id,updated_at into i,oldtime;
 assert (select created_by=u from public.shopping_items where id=i),'actor stamped';
 failed:=false;begin insert into public.shopping_items(household_id,name) values(h,upper(n));exception when unique_violation then failed:=true;end;assert failed,'case-insensitive duplicate blocked';
 perform set_config('request.jwt.claim.sub',v::text,true);
 assert (select count(*)=1 from public.shopping_items where id=i),'shared read';
 update public.shopping_items set purchased=true where id=i;
 assert (select purchased and updated_by=v and updated_at>oldtime from public.shopping_items where id=i),'shared purchase and sync timestamp';
 update public.shopping_items set archived=true where id=i;
 update public.shopping_items set archived=false,purchased=false where id=i;
 assert (select favorite and not purchased and not archived from public.shopping_items where id=i),'restore retains favorite';
 failed:=false;begin update public.shopping_items set household_id=gen_random_uuid() where id=i;exception when others then failed:=true;end;assert failed,'cannot move household';
 failed:=false;begin delete from public.shopping_items where id=i;exception when insufficient_privilege then failed:=true;end;assert failed,'no irreversible delete';
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 assert (select count(*)=0 from public.shopping_items where id=i),'outsider read denied';
 update public.shopping_items set purchased=true where id=i;assert not found,'outsider write denied';
 failed:=false;begin insert into public.shopping_items(household_id,name) values(h,'outsider');exception when others then failed:=true;end;assert failed,'outsider insert denied';
end $$;
set local role anon;
do $$ declare failed boolean:=false;begin begin perform * from public.shopping_items;exception when insufficient_privilege then failed:=true;end;assert failed,'anonymous read denied';end $$;
reset role;
select 'PASS: shared list, duplicate protection, restore, household isolation and permissions; fixtures rolled back' as result;
rollback;
