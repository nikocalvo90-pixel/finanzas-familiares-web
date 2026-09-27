-- Policy/metadata integration tests. Synthetic storage metadata only; no physical files.
-- Everything, including audit rows, is rolled back.
begin;
do $$
declare h uuid; u uuid; other_user uuid; a uuid;
begin
 select household_id,user_id into h,u from public.household_members order by joined_at limit 1;
 select user_id into other_user from public.household_members where household_id=h and user_id<>u limit 1;
 select id into a from public.accounts where household_id=h and not is_archived limit 1;
 assert h is not null and a is not null,'test needs a household and active account';
 perform set_config('test.documents_household',h::text,true);perform set_config('test.documents_user',u::text,true);
 perform set_config('test.documents_other',coalesce(other_user::text,''),true);perform set_config('test.documents_account',a::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);
end $$;
set local role authenticated;
do $$
declare h uuid:=current_setting('test.documents_household')::uuid; u uuid:=current_setting('test.documents_user')::uuid;
 a uuid:=current_setting('test.documents_account')::uuid; other_user text:=current_setting('test.documents_other');
 t uuid; d uuid; p text; sha text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); failed boolean; n integer;
begin
 insert into public.transactions(household_id,transaction_date,amount,type,concept,account_id,created_by)
 values(h,'2040-01-01',1,'GASTO','Synthetic document policy test',a,u) returning id into t;
 insert into public.transaction_documents(household_id,transaction_id,filename,mime_type,extension,size_bytes,sha256,status)
 values(h,t,'synthetic.pdf','application/pdf','pdf',12,sha,'READY') returning id,object_path into d,p;
 assert (select status='PENDING' and transaction_label='Synthetic document policy test' from public.transaction_documents where id=d),'cannot forge ready state';
 failed:=false;
 begin update public.transaction_documents set status='READY' where id=d; exception when others then failed:=true; end;
 assert failed,'missing upload cannot finalize';
 failed:=false;
 begin insert into public.transaction_documents(household_id,transaction_id,filename,mime_type,extension,size_bytes,sha256)
 values(h,gen_random_uuid(),'foreign.pdf','application/pdf','pdf',12,repeat('a',64));exception when others then failed:=true;end;
 assert failed,'invalid transaction cannot be attached';
 failed:=false;
 begin insert into storage.objects(bucket_id,name,metadata) values('finanzas-documents',h::text||'/unknown.pdf','{"size":12,"mimetype":"application/pdf"}');
 exception when insufficient_privilege then failed:=true; end;
 assert failed,'upload needs a registered pending document';
 insert into storage.objects(bucket_id,name,metadata) values('finanzas-documents',p,'{"size":12,"mimetype":"application/pdf"}');
 update public.transaction_documents set status='READY' where id=d;
 assert (select status='READY' from public.transaction_documents where id=d),'registered object finalizes';
 update storage.objects set metadata='{}' where bucket_id='finanzas-documents' and name=p;
 get diagnostics n=row_count;assert n=0,'original cannot be overwritten';
 failed:=false;
 begin update public.transaction_documents set size_bytes=13 where id=d;exception when others then failed:=true;end;
 assert failed,'file metadata immutable';
 failed:=false;
 begin insert into public.transaction_documents(household_id,transaction_id,filename,mime_type,extension,size_bytes,sha256)
 values(h,t,'duplicate.pdf','application/pdf','pdf',12,sha);exception when unique_violation then failed:=true;end;
 assert failed,'same transaction and content cannot be duplicated';
 update public.transaction_documents set archived=true where id=d;
 assert exists(select 1 from storage.objects where bucket_id='finanzas-documents' and name=p),'retired originals remain accessible to household';
 update public.transaction_documents set archived=false where id=d;
 assert (select not archived from public.transaction_documents where id=d),'restoration';
 assert (public.transaction_sync_state(h)->>'documents_count')::integer>0,'document sync';
 if other_user<>'' then
   perform set_config('request.jwt.claim.sub',other_user,true);
   assert exists(select 1 from public.transaction_documents where id=d),'other member can read metadata';
   assert exists(select 1 from storage.objects where bucket_id='finanzas-documents' and name=p),'other member can read file';
   perform set_config('request.jwt.claim.sub',u::text,true);
 end if;
 delete from public.transactions where id=t;
 assert (select transaction_id is null and archived from public.transaction_documents where id=d),'deleted movement preserves retired original';
 assert exists(select 1 from storage.objects where bucket_id='finanzas-documents' and name=p),'file remains reachable in archive';
 failed:=false;begin update public.transaction_documents set archived=false where id=d;exception when others then failed:=true;end;
 assert failed,'orphan cannot be restored to a deleted movement';
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 assert not exists(select 1 from public.transaction_documents where id=d),'outsider cannot read metadata';
 assert not exists(select 1 from storage.objects where bucket_id='finanzas-documents' and name=p),'outsider cannot read file';
 update public.transaction_documents set archived=false where id=d;get diagnostics n=row_count;assert n=0,'outsider cannot edit metadata';
 failed:=false;begin insert into storage.objects(bucket_id,name,metadata) values('finanzas-documents',h::text||'/outsider.pdf','{}');exception when insufficient_privilege then failed:=true;end;
 assert failed,'outsider cannot upload';
end $$;
reset role;
set local role anon;
do $$ declare failed boolean:=false;begin
 begin perform 1 from public.transaction_documents;exception when insufficient_privilege then failed:=true;end;
 assert failed,'anonymous metadata access denied';
 assert not exists(select 1 from storage.objects where bucket_id='finanzas-documents'),'anonymous object access denied';
end $$;
reset role;
rollback;
select 'PASS: document metadata, pending/ready validation, immutability, deduplication, archive, orphan preservation, shared access, outsider and anonymous isolation. Synthetic metadata rolled back; physical Storage transport not exercised.' result;
