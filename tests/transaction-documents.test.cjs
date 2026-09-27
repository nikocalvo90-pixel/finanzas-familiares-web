const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const docs=require('../docs/transaction-documents.js');
const file=(name='factura.pdf',text='%PDF-1.7\nsynthetic fixture')=>new File([text],name,{type:'application/pdf'});
const context={householdId:'household',transactionId:'transaction'};

test('document validation checks content, size, filename and stable digest before any upload',async()=>{
 const a=await docs.describe(file(),webcrypto),b=await docs.describe(file('copia.pdf'),webcrypto);
 assert.equal(a.mime_type,'application/pdf');assert.equal(a.sha256,b.sha256);
 assert.equal(a.sha256.length,64);
 await assert.rejects(docs.describe(file('fake.pdf','<html>not a PDF</html>'),webcrypto),/Formato no compatible/);
 await assert.rejects(docs.describe(file('factura.html'),webcrypto),/extensión/);
 await assert.rejects(docs.describe(file('vacio.pdf',''),webcrypto),/vacío/);
 await assert.rejects(docs.describe({size:docs.MAX_SIZE+1},webcrypto),/10 MB/);
 const safe=await docs.describe(file('../factura.pdf'),webcrypto);assert.equal(safe.filename.includes('/'),false);
});
test('phone image formats are detected without trusting browser MIME labels',()=>{
 assert.equal(docs.detect(Uint8Array.from([255,216,255,0]).buffer).mime,'image/jpeg');
 assert.equal(docs.detect(Uint8Array.from([137,80,78,71,13,10,26,10]).buffer).mime,'image/png');
 assert.equal(docs.detect(new TextEncoder().encode('RIFF1234WEBP').buffer).mime,'image/webp');
 assert.equal(docs.detect(new TextEncoder().encode('1234ftypheic').buffer).mime,'image/heic');
 assert.equal(docs.detect(new TextEncoder().encode('1234ftypmif1').buffer).mime,'image/heif');
 assert.equal(docs.detect(new TextEncoder().encode('1234ftypavif').buffer),null);
});
function apiFixture(options={}){
 let record=options.record||null,uploads=0,creates=0,finalizes=0;
 return {
  find:async()=>record,
  create:async payload=>{creates++;record={...payload,id:'doc',object_path:'household/doc.pdf',status:'PENDING',archived:false};if(options.createResponseLost)throw new Error('Connection lost');return record},
  upload:async()=>{uploads++;if(options.uploadError)throw new Error('Upload response lost')},
  finalize:async()=>{finalizes++;if(options.finalizeError)throw new Error('No stored object');return record={...record,status:'READY'}},
  counts:()=>({uploads,creates,finalizes}),record:()=>record
 };
}
test('upload registers metadata then verifies the object before reporting success',async()=>{
 const api=apiFixture();const result=await docs.upload(file(),context,api,webcrypto);
 assert.equal(result.record.status,'READY');assert.equal(result.existing,false);
 assert.deepEqual(api.counts(),{uploads:1,creates:1,finalizes:1});
 await docs.upload(file('otro nombre.pdf'),context,api,webcrypto);
 assert.deepEqual(api.counts(),{uploads:1,creates:1,finalizes:1});
});
test('lost metadata and upload responses recover without creating duplicate files',async()=>{
 const api=apiFixture({createResponseLost:true,uploadError:true});
 const result=await docs.upload(file(),context,api,webcrypto);
 assert.equal(result.record.status,'READY');assert.equal(api.counts().creates,1);
});
test('a failed upload stays pending and never appears successfully stored',async()=>{
 const api=apiFixture({uploadError:true,finalizeError:true});
 await assert.rejects(docs.upload(file(),context,api,webcrypto),/pendiente/);
 assert.equal(api.record().status,'PENDING');
 const retry=apiFixture({record:api.record()});await docs.upload(file(),context,retry,webcrypto);
 assert.equal(retry.counts().creates,0);assert.equal(retry.record().status,'READY');
});
test('selecting a retired document requires explicit restoration and performs no upload',async()=>{
 const api=apiFixture({record:{status:'READY',archived:true}});
 const result=await docs.upload(file(),context,api,webcrypto);
 assert.equal(result.archived,true);assert.equal(api.counts().uploads,0);
});
test('download links retain private signed endpoints and encode filenames safely',()=>{
 const base='https://example.supabase.co';
 const url=new URL(docs.signedUrl(base,'/object/sign/finanzas-documents/a/b.pdf?token=test','factura & recibo.pdf',true));
 assert.equal(url.searchParams.get('download'),'factura & recibo.pdf');assert.equal(url.searchParams.get('token'),'test');
 for(const value of ['javascript:alert(1)','https://evil.example/file','/object/public/finanzas-documents/a.pdf','/object/sign/finanzas-documents/../../escape'])
   assert.throws(()=>docs.signedUrl(base,value,'file.pdf',false));
});
