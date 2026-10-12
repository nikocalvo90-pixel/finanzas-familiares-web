-- Synthetic users and households only. Every fixture is rolled back.
begin;
do $test$
declare u uuid:=gen_random_uuid();m uuid:=gen_random_uuid();other_u uuid:=gen_random_uuid();h uuid;other_h uuid;cat uuid;other_cat uuid;b uuid:=gen_random_uuid();code text;n integer;blocked boolean;
begin
 insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated',u||'@budget-test.invalid'),(m,'authenticated','authenticated',m||'@budget-test.invalid'),(other_u,'authenticated','authenticated',other_u||'@budget-test.invalid');
 perform set_config('request.jwt.claim.sub',u::text,true);execute 'set local role authenticated';
 h:=public.initialize_household('Synthetic budget A','Owner');code:=public.create_household_invite(h);
 select id into cat from public.categories where household_id=h and kind='GASTO' limit 1;
 insert into public.budgets(id,household_id,category_id,month,amount) values(b,h,cat,'2026-10-01',100);
 insert into public.budgets(household_id,category_id,month,amount) values(h,cat,'2026-11-01',120);
 assert (select count(*)=1 from public.budgets where household_id=h and month='2026-10-01'),'month scope';
 blocked:=false;begin insert into public.budgets(household_id,category_id,month,amount) values(h,cat,'2026-10-01',300);exception when unique_violation then blocked:=true;end;assert blocked,'duplicate category month denied';
 blocked:=false;begin insert into public.budgets(household_id,category_id,month,amount) values(h,cat,'2026-12-12',300);exception when check_violation then blocked:=true;end;assert blocked,'month must start on day one';
 blocked:=false;begin insert into public.budgets(household_id,category_id,month,amount) values(h,cat,'2026-12-01',-1);exception when check_violation then blocked:=true;end;assert blocked,'negative budget denied';
 perform set_config('request.jwt.claim.sub',other_u::text,true);other_h:=public.initialize_household('Synthetic budget B','Other');
 select id into other_cat from public.categories where household_id=other_h and kind='GASTO' limit 1;
 assert not exists(select 1 from public.budgets where household_id=h),'foreign rows hidden';
 update public.budgets set amount=999 where id=b;get diagnostics n=row_count;assert n=0,'foreign update denied';
 blocked:=false;begin insert into public.budgets(household_id,category_id,month,amount) values(h,cat,'2026-12-01',1);exception when insufficient_privilege then blocked:=true;end;assert blocked,'foreign insertion denied';
 blocked:=false;begin insert into public.budgets(household_id,category_id,month,amount) values(other_h,cat,'2026-12-01',1);exception when foreign_key_violation then blocked:=true;end;assert blocked,'cross-household category denied';
 perform set_config('request.jwt.claim.sub',m::text,true);perform public.join_household_by_code(code,'Member');
 assert (select amount=100 from public.budgets where id=b),'member can read';
 update public.budgets set amount=888 where id=b and household_id=h and updated_at='2000-01-01';get diagnostics n=row_count;assert n=0,'conditional stale write updates nothing';
 update public.budgets set amount=200 where id=b and household_id=h;get diagnostics n=row_count;assert n=1,'member can collaborate on limit';
 assert (select amount=200 from public.budgets where id=b),'confirmed edit';
 perform public.leave_household(h);assert not exists(select 1 from public.budgets where id=b),'stale member claims denied after leaving';
 perform set_config('request.jwt.claim.sub',u::text,true);assert (select amount=200 from public.budgets where id=b),'remaining owner retains limit';
 execute 'reset role';execute 'set local role anon';
 blocked:=false;begin select count(*) into n from public.budgets;assert n=0,'anonymous rows hidden';exception when insufficient_privilege then blocked:=true;end;
 execute 'reset role';
end $test$;
rollback;
select 'PASS: budget category/month constraints, two-household isolation, shared member editing, conditional writes and departed/anonymous denial. No real budgets changed.' result;
