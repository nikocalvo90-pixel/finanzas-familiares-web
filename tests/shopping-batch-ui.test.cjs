const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{webcrypto}=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'../docs/index.html'),'utf8');
const script=html.slice(html.indexOf('(function(){')+12,html.lastIndexOf('\n(async()=>{\n registerNotificationWorker();'));
function setup(){
 const roots=[],storage=new Map();
 function element(){
  const e={children:new Map(),dataset:{},value:'',checked:false,disabled:false,textContent:'',style:{},classList:{toggle(){}},removed:false,
   querySelector:s=>s==='.close'?e.close:s==='.bulk-toolbar strong'?e.strong:e.children.get(s.slice(1)),querySelectorAll:()=>[],remove:()=>e.removed=true};
  e.close={disabled:false};e.strong={textContent:''};
  Object.defineProperty(e,'innerHTML',{get:()=>e.markup||'',set:s=>{e.markup=s;for(const m of s.matchAll(/id="([^"]+)"/g))if(!e.children.has(m[1]))e.children.set(m[1],element())}});return e;
 }
 const root=element();
 const doc={hidden:false,createElement:()=>element(),body:{appendChild:e=>roots.push(e)},getElementById:id=>id==='root'?root:roots.find(e=>e.id===id&&!e.removed),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
 const ctx=vm.createContext({Intl,URL,URLSearchParams,Uint8Array,AbortController,AbortSignal,crypto:webcrypto,atob,
  ShoppingBatch:require('../docs/shopping-batch.js'),SaveRecovery:require('../docs/save-recovery.js'),EntryDrafts:require('../docs/entry-drafts.js'),FamilyAccess:require('../docs/account-access.js'),
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:doc,window:{addEventListener(){}},navigator:{onLine:true},location:{hash:'#compra',href:'https://casuo.es/'},setTimeout,clearTimeout,setInterval:()=>0,clearInterval,confirm:()=>true,fetch:()=>{throw Error('Unexpected network')}});
 vm.runInContext(script,ctx);const run=s=>vm.runInContext(s,ctx);
 run("saveSession({access_token:'token',user:{id:'user'}});state.user={id:'user'};state.household={id:'home'};state.deviceUnlocked=true;state.data={shopping:[]};renderApp=()=>{};loadAll=async()=>true;toast=()=>{};openShoppingBatch()");
 const modal=roots.at(-1),get=id=>modal.querySelector('#'+id);return {run,ctx,storage,modal,get};
}
test('bulk UI review is local and offline saving retains stable pending operations',async()=>{
 const s=setup();s.get('batch-raw').value='dos huevos, leche';s.get('batch-review').onclick();
 assert.match(s.get('batch-preview').innerHTML,/huevos/);s.ctx.navigator.onLine=false;
 await s.get('batch-save').onclick();
 const draft=JSON.parse([...s.storage.values()].find(x=>x.includes('shopping-batch')));
 assert.equal(draft.form.operations.length,2);assert.equal(draft.form.operations[0].payload.quantity,'2');assert.equal(draft.form.operations[0].done,false);
 assert.equal(s.get('batch-raw').readOnly,true);assert.match(s.get('batch-status').textContent,/0 de 2/);
});
test('bulk UI confirms partial completion and skips the confirmed product on retry',async()=>{
 const s=setup();s.get('batch-raw').value='pan, huevos';s.get('batch-review').onclick();s.run("calls=[];fail=true;saveSharedRecord=async op=>{calls.push(op.id);if(calls.length===2&&fail)throw Error('network');return {record:{id:op.id,household_id:'home',name:op.label}}}");
 await s.get('batch-save').onclick();assert.match(s.get('batch-status').textContent,/1 de 2/);assert.equal(s.run('state.data.shopping.length'),1);
 s.run('fail=false');await s.get('batch-save').onclick();const calls=s.run('calls');assert.equal(calls.length,3);assert.equal(calls[1],calls[2]);assert.equal(s.run('state.data.shopping.length'),2);assert.equal(s.modal.removed,true);
});
test('bulk UI does not send when it cannot preserve the immutable operations',async()=>{
 const s=setup();s.get('batch-raw').value='pan';s.get('batch-review').onclick();let sends=0;s.ctx.localStorage.setItem=()=>{throw Error('quota')};s.ctx.count=()=>sends++;s.run('saveSharedRecord=async()=>{count()}');
 await s.get('batch-save').onclick();assert.equal(sends,0);assert.equal(s.get('batch-raw').readOnly,false);assert.match(s.get('batch-status').textContent,/no pudo conservar/);
});
test('bulk UI ignores late save responses after another session starts',async()=>{
 const s=setup();s.get('batch-raw').value='pan';s.get('batch-review').onclick();let resolve;s.ctx.pending=new Promise(r=>resolve=r);s.run('saveSharedRecord=()=>pending');
 const save=s.get('batch-save').onclick();s.run("sessionEpoch++;state.user={id:'other'};state.household={id:'other-home'};state.data={shopping:[]}");resolve({record:{id:'late',household_id:'home'}});await save;
 assert.equal(s.run('state.data.shopping.length'),0);const draft=JSON.parse([...s.storage.values()].find(x=>x.includes('shopping-batch')));assert.equal(draft.form.operations[0].done,false);
});
