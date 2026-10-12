const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{webcrypto}=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'../docs/index.html'),'utf8'),script=html.slice(html.indexOf('(function(){')+12,html.lastIndexOf('\n(async()=>{\n registerNotificationWorker();'));
const response=(data,status=200)=>({ok:status<400,status,text:async()=>JSON.stringify(data)});
function setup(id=null){
 const roots=[],storage=new Map();function element(){const e={children:new Map(),dataset:{},style:{},value:'',disabled:false,textContent:'',hidden:false,removed:false,classList:{toggle(){}},addEventListener(){},querySelector:s=>s==='.close'?e.close:e.children.get(s.slice(1)),querySelectorAll:()=>[],remove:()=>e.removed=true};e.close={disabled:false};Object.defineProperty(e,'innerHTML',{get:()=>e.markup||'',set:s=>{e.markup=s;for(const m of s.matchAll(/id="([^"]+)"/g))if(!e.children.has(m[1]))e.children.set(m[1],element())}});return e}
 const root=element(),feedback=element(),doc={hidden:false,createElement:element,body:{appendChild:e=>roots.push(e)},getElementById:id=>id==='root'?root:id==='budget-feedback'?feedback:roots.find(e=>e.id===id&&!e.removed),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
 const ctx=vm.createContext({Intl,URL,URLSearchParams,Uint8Array,AbortController,AbortSignal,crypto:webcrypto,atob,FamilyBudgets:require('../docs/budgets.js'),SaveRecovery:require('../docs/save-recovery.js'),EntryDrafts:require('../docs/entry-drafts.js'),FamilyAccess:require('../docs/account-access.js'),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:doc,window:{addEventListener(){}},navigator:{onLine:true},location:{hash:'#presupuestos',href:'https://casuo.es/'},setTimeout,clearTimeout,setInterval:()=>0,clearInterval,confirm:()=>true,fetch:async()=>response([])});
 feedback.hidden=true;vm.runInContext(script,ctx);const run=s=>vm.runInContext(s,ctx);
 run("saveSession({access_token:'token',user:{id:'user'}});state.user={id:'user'};state.household={id:'home'};state.deviceUnlocked=true;state.budgetMonth='2026-10';state.data={categories:[{id:'food',name:'Comida',kind:'GASTO'}],budgetFeed:{month:'2026-10',budgets:[]}};state.budgetViewFeed={budgets:[{id:'existing',household_id:'home',category_id:'food',month:'2026-10-01',amount:100,updated_at:'v1'}]};loadAll=async()=>true;renderApp=()=>{};toast=()=>{}");
 run(id?"openBudgetEditor('existing')":"openBudgetEditor()");const modal=roots.at(-1),get=id=>modal.querySelector('#'+id);get('budget-month').value='2026-10';get('budget-category').value='food';get('budget-amount').value='300';return {ctx,run,modal,get,storage,feedback};
}
test('budget editor recovers a lost create reply by ID without a duplicate',async()=>{
 const s=setup();let saved=null,writes=0;s.ctx.fetch=async(url,opt={})=>{if(opt.method==='POST'){writes++;saved={...JSON.parse(opt.body),updated_at:'v1'};throw Error('lost reply')}return response(url.includes('&id=eq.')&&saved?[saved]:[])};
 await s.get('budget-save').onclick();assert.equal(writes,1);assert.equal(s.modal.removed,true);assert.equal(s.run('state.data.budgetFeed.budgets[0].amount'),300);assert.ok(![...s.storage.keys()].some(k=>k.endsWith(':budget')));
});
test('conditional budget edits reject another member’s version instead of overwriting it',async()=>{
 const s=setup('existing');let writes=0;s.ctx.fetch=async(url,opt={})=>{if(opt.method){writes++;return response([])}return response([{id:'existing',household_id:'home',amount:200,updated_at:'v2'}])};
 await s.get('budget-save').onclick();assert.equal(writes,0);assert.match(s.get('budget-save-state').textContent,/Otra persona/);assert.equal(s.modal.removed,false);
});
test('new limit preflight cannot continue after a different session starts',async()=>{
 const s=setup();let resolve;s.ctx.fetch=()=>new Promise(r=>resolve=r);const save=s.get('budget-save').onclick();s.run("sessionEpoch++;state.user={id:'other'};state.household={id:'other-home'}");resolve(response([]));await save;
 assert.equal(s.run('state.data.budgetFeed.budgets.length'),0);assert.ok(![...s.storage.keys()].some(k=>k.endsWith(':budget')));
});
test('local storage failure blocks budget POST while retaining editable fields',async()=>{
 const s=setup();s.ctx.localStorage.setItem=()=>{throw Error('quota')};let writes=0;s.ctx.fetch=async(url,opt={})=>{if(opt.method)writes++;return response([])};
 await s.get('budget-save').onclick();assert.equal(writes,0);assert.match(s.get('budget-save-state').textContent,/no se pudo conservar/);
});
test('all monthly expenses are paginated and remain household-filtered',async()=>{
 const s=setup();let pages=0;s.ctx.fetch=async url=>{assert.match(url,/household_id=eq.home/);if(url.includes('/transactions?')){pages++;assert.match(url,/type=in\.\(GASTO,DEVOLUCION\)/);return response(pages===1?Array.from({length:1000},(_,i)=>({id:String(i)})):[{id:'last'}])}return response([])};
 const feed=await s.run("fetchBudgetFeed('2026-10','home')");assert.equal(feed.transactions.length,1001);assert.equal(pages,2);
});
test('removing a changed budget never sends DELETE',async()=>{
 const s=setup('existing');let deletes=0;s.ctx.fetch=async(url,opt={})=>{if(url.includes('/rpc/'))return response(true);if(opt.method==='DELETE'){deletes++;return response([])}return response([{id:'existing',household_id:'home',updated_at:'v2'}])};
 await s.run("removeBudget('existing',{disabled:false})");assert.equal(deletes,0);assert.match(s.feedback.textContent,/Otra persona/);
});
test('lost DELETE reply is confirmed by disappearance and current membership',async()=>{
 const s=setup('existing');let present=true,deletes=0;s.ctx.fetch=async(url,opt={})=>{if(url.includes('/rpc/'))return response(true);if(opt.method==='DELETE'){deletes++;present=false;throw Error('lost reply')}return response(present?[{id:'existing',household_id:'home',updated_at:'v1'}]:[])};
 await s.run("removeBudget('existing',{disabled:false})");assert.equal(deletes,1);assert.equal(s.feedback.hidden,true);assert.equal(s.feedback.textContent,'');
});
test('shared synchronization watches the budget month currently selected',async()=>{
 const s=setup();s.modal.remove();s.run("state.member={role:'OWNER',display_name:'Test'};state.budgetMonth='2026-09';state.budgetViewFeed.month='2026-09';state.budgetSignature='[]';state.syncSignature='{}';state.shoppingSignature='[]';state.loadedMonth=localMonth();loads=0;loadAll=async()=>{loads++}");
 let selected=false;s.ctx.fetch=async url=>{if(url.includes('/household_members?'))return response([{role:'OWNER',display_name:'Test'}]);if(url.includes('/rpc/'))return response({});if(url.includes('/budgets?')){assert.match(url,/month=eq.2026-09-01/);selected=true;return response([{id:'existing',updated_at:'v2'}])}return response([])};
 await s.run('checkForSharedChanges()');assert.equal(selected,true);assert.equal(s.run('loads'),1);
});
