-- Tests only synthetic users; rollback includes all Auth/storage metadata.
begin;
do $test$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();h uuid;h2 uuid;code text;a uuid;t uuid;d uuid;p text;before_tx jsonb;before_closure jsonb;
begin
 assert not has_function_privilege('authenticated','private.cleanup_deleted_account()','EXECUTE');
 assert not has_function_privilege('anon','private.guard_account_deletion()','EXECUTE');
 insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated',u||'@account-test.invalid'),(v,'authenticated','authenticated',v||'@account-test.invalid');
 perform set_config('request.jwt.claim.sub',u::text,true);execute 'set local role authenticated';
 h:=public.initialize_household('Deletion test','Previous owner','Preserved account',123,current_date);h2:=public.create_household('Other owned household','Previous owner');code:=public.create_household_invite(h);
 select id into a from public.accounts where household_id=h limit 1;
 insert into public.transactions(household_id,created_by,transaction_date,type,amount,concept,account_id,person_user_id,person_label)
 values(h,u,'2001-01-15','GASTO',10,'Preserved closed transaction',a,u,'Historical name') returning id into t;
 insert into public.transaction_documents(household_id,transaction_id,filename,mime_type,extension,size_bytes,sha256)
 values(h,t,'synthetic.pdf','application/pdf','pdf',12,repeat('b',64)) returning id,object_path into d,p;
 execute 'reset role';
 insert into storage.objects(bucket_id,name,owner,owner_id,metadata) values('finanzas-documents',p,u,u::text,'{"size":12,"mimetype":"application/pdf"}');
 update public.transaction_documents set status='READY' where id=d;
 execute 'set local role authenticated';
 perform public.close_month(h,'2001-01-01');
 select to_jsonb(x) into before_tx from public.transactions x where id=t;
 select to_jsonb(x) into before_closure from public.monthly_closures x where household_id=h and month='2001-01-01';
 perform set_config('request.jwt.claim.sub',v::text,true);perform public.join_household_by_code(code,'New owner');
 perform set_config('request.jwt.claim.sub',u::text,true);perform public.transfer_household_ownership(h,v);
 -- A different household still owned by the account must block its deletion.
 execute 'reset role';
 begin update auth.users set deleted_at=now() where id=u;raise exception 'owner deletion accepted';exception when check_violation then null;end;
 assert (select deleted_at is null from auth.users where id=u),'blocked deletion rolled back';
 assert exists(select 1 from public.profiles where id=u),'profile retained on failure';
 assert exists(select 1 from public.household_members where user_id=u and household_id=h),'membership retained on failure';
 insert into public.household_members(household_id,user_id,role,display_name) values(h2,v,'MEMBER','New owner');
 execute 'set local role authenticated';perform public.transfer_household_ownership(h2,v);execute 'reset role';
 -- This models the deleted_at transition used by the Auth admin soft-delete API.
 update auth.users set deleted_at=now() where id=u;
 assert not exists(select 1 from public.household_members where user_id=u),'all memberships removed';
 assert not exists(select 1 from public.profiles where id=u),'profile removed';
 assert not exists(select 1 from public.notification_preferences where user_id=u),'notification preferences removed';
 assert not exists(select 1 from public.push_subscriptions where user_id=u),'push subscriptions removed';
 assert (select to_jsonb(x)=before_tx from public.transactions x where id=t),'closed transaction entirely unchanged';
 assert (select to_jsonb(x)=before_closure from public.monthly_closures x where household_id=h and month='2001-01-01'),'closed report entirely unchanged';
 assert exists(select 1 from public.transaction_documents where id=d and status='READY'),'document metadata preserved';
 assert exists(select 1 from storage.objects where name=p and bucket_id='finanzas-documents'),'shared object preserved';
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',v::text,true);code:=public.create_household_invite(h);perform set_config('request.jwt.claim.sub',u::text,true);
 assert not public.is_household_member(h),'stale JWT cannot access old household';
 assert not exists(select 1 from public.transactions where id=t),'stale JWT loses RLS access';
 begin perform public.join_household_by_code(code,'Back again');raise exception 'deleted account rejoined';exception when insufficient_privilege then null;end;
 begin perform public.initialize_household('Deleted user new home','Back again');raise exception 'deleted account created household';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',v::text,true);
 assert exists(select 1 from public.transactions where id=t),'remaining member retains transaction access';
 assert exists(select 1 from storage.objects where name=p and bucket_id='finanzas-documents'),'remaining member retains document access';
 begin insert into public.household_members(household_id,user_id,role,display_name) values(h,u,'MEMBER','Deleted user');raise exception 'owner restored deleted membership';exception when insufficient_privilege then null;end;
 execute 'reset role';
 begin insert into public.household_members(household_id,user_id,role,display_name) values(h,u,'MEMBER','Deleted user');raise exception 'privileged restore accepted';exception when insufficient_privilege then null;end;
 -- No transition means no cleanup is repeated on subsequent Auth updates.
 update auth.users set deleted_at=now() where id=u;
 assert (select to_jsonb(x)=before_tx from public.transactions x where id=t);
end $test$;
rollback;
