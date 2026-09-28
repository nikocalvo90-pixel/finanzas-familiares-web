const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const html=fs.readFileSync(require('node:path').join(__dirname,'../docs/index.html'),'utf8');
const script=html.slice(html.indexOf('(function(){')+'(function(){'.length,html.lastIndexOf('\n(async()=>{\n registerNotificationWorker();'));
const response=(data,status=200)=>({ok:status<400,status,text:async()=>JSON.stringify(data)});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function setup(){
 const storage=new Map(),elements=new Map(),events={},intervals=new Set(),removed=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',classList:{toggle(){}},textContent:''});return elements.get(id)};
 const ctx=vm.createContext({Intl,URL,URLSearchParams,Uint8Array,AbortController,AbortSignal,crypto:webcrypto,atob,
   localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
   document:{getElementById:element,querySelector:()=>null,querySelectorAll:()=>[{remove:()=>removed.push(true)}],addEventListener:(name,cb)=>events[name]=cb,hidden:false},
   window:{addEventListener:(name,cb)=>events[name]=cb},navigator:{userAgent:'Test'},
   location:{href:'https://example.com/app/',hash:'#inicio'},setTimeout,clearTimeout,
   setInterval:fn=>{intervals.add(fn);return fn},clearInterval:fn=>intervals.delete(fn),
   fetch:async()=>response([])
 });
 vm.runInContext(script,ctx);
 const run=s=>vm.runInContext(s,ctx);
 run("saveSession({access_token:'token',refresh_token:'refresh',user:{id:'user'}});state.user={id:'user',email:'test@example.com'};state.household={id:'household',name:'Test'};state.data={secret:'private'};state.deviceUnlocked=true");
 return {ctx,run,events,intervals,removed,root:element('root')};
}
test('real router and shell cannot render private content when locked',()=>{
 const s=setup();
 s.run("setDeviceLock({enabled:true,userId:'user',credentialId:'YQ'});state.deviceUnlocked=false;viewInicio=()=>{throw Error('private view reached')};renderApp()");
 assert.match(s.root.innerHTML,/Finanzas protegidas/);
 s.run("shell('PRIVATE FINANCES')");
 assert.doesNotMatch(s.root.innerHTML,/PRIVATE FINANCES/);
 assert.equal(s.intervals.size,0);
});
test('logout clears all private state and timers before remote logout completes',()=>{
 const s=setup();s.ctx.fetch=()=>new Promise(()=>{});
 s.run("state.wealthDraft={secret:'x'};state.entryPending={secret:'y'};startAutoSync();logoutDevice()");
 assert.equal(s.run('getSession()'),null);
 assert.equal(s.run('state.data'),null);
 assert.equal(s.run('state.user'),null);
 assert.equal(s.run('state.wealthDraft'),undefined);
 assert.equal(s.run('state.entryPending'),undefined);
 assert.equal(s.intervals.size,0);
 assert.match(s.root.innerHTML,/Sesión cerrada/);
 s.events.hashchange();s.run("shell('PRIVATE FINANCES')");
 assert.doesNotMatch(s.root.innerHTML,/PRIVATE FINANCES/);
});
test('a late token refresh cannot resurrect a logged out session even if fetch ignores abort',async()=>{
 const s=setup(),pending=deferred();let signal;
 s.ctx.fetch=(url,opt)=>{if(url.includes('grant_type')){signal=opt.signal;return pending.promise}return Promise.resolve(response({}))};
 const result=s.run('refreshSession(getSession())');
 s.run('logoutDevice()');
 assert.equal(signal.aborted,true);
 pending.resolve(response({access_token:'late-token',refresh_token:'late-refresh'}));
 await assert.rejects(result,e=>e.sessionCancelled===true);
 assert.equal(s.run('getSession()'),null);
});
test('a late data load is discarded on logout without overwriting new state',async()=>{
 const s=setup(),pending=deferred();
 s.ctx.fetch=(url)=>url.includes('household_members')?pending.promise:Promise.resolve(response({}));
 const result=s.run('loadAll(true)');s.run("logoutDevice();saveSession({access_token:'new-token',user:{id:'other-user'}});state.user={id:'other-user'};state.member={household_id:'new-household'}");
 pending.resolve(response([{household_id:'old-household',role:'OWNER'}]));
 await assert.rejects(result,e=>e.sessionCancelled===true);
 assert.equal(s.run('state.member.household_id'),'new-household');assert.equal(s.run('state.data'),null);
});
test('lock stops in-flight loads and background sync',async()=>{
 const s=setup(),pending=deferred();let calls=0;
 s.ctx.fetch=()=>{calls++;return pending.promise};
 s.run("setDeviceLock({enabled:true,userId:'user',credentialId:'YQ'});startAutoSync()");
 const result=s.run('loadAll(true)');s.run('lockDeviceNow()');
 await s.run('checkForSharedChanges()');assert.equal(calls,1);
 pending.resolve(response([{household_id:'old-household',role:'OWNER'}]));
 await assert.rejects(result,e=>e.sessionCancelled===true);
 assert.equal(s.run('state.data'),null);assert.equal(s.intervals.size,0);
 assert.match(s.root.innerHTML,/Finanzas protegidas/);
 await assert.rejects(s.run("authed('/rest/v1/transactions')"),e=>e.sessionCancelled===true);
});
test('logout in another tab clears local private data',()=>{
 const s=setup();s.run('startAutoSync();clearSession()');s.events.storage({key:s.run('STORE')});
 assert.equal(s.run('state.user'),null);assert.equal(s.run('state.data'),null);assert.equal(s.intervals.size,0);
 assert.match(s.root.innerHTML,/otra pestaña/);
});
test('late biometric assertion cannot unlock a later session',async()=>{
 const s=setup(),pending=deferred();s.ctx.navigator.credentials={get:()=>pending.promise};
 s.run("setDeviceLock({enabled:true,userId:'user',credentialId:'YQ'});state.deviceUnlocked=false");
 const result=s.run('performDeviceUnlock()');s.run('logoutDevice()');pending.resolve({id:'YQ'});
 await assert.rejects(result,e=>e.sessionCancelled===true);assert.equal(s.run('state.deviceUnlocked'),false);
});
test('a late password response cannot sign back in after session cancellation',async()=>{
 const s=setup(),pending=deferred();s.ctx.fetch=()=>pending.promise;
 const result=s.run("login('test@example.com','synthetic-password')");s.run('logoutDevice()');
 pending.resolve(response({access_token:'late',user:{id:'user'}}));
 await assert.rejects(result,e=>e.sessionCancelled===true);assert.equal(s.run('getSession()'),null);
});
test('valid device unlock reloads the household and resumes a single sync timer',async()=>{
 const s=setup();s.ctx.navigator.credentials={get:async()=>({id:'YQ'})};
 s.ctx.fetch=async url=>response(url.includes('/household_members?')?[{household_id:'household',role:'OWNER'}]:url.includes('/households?')?[{id:'household',name:'Test'}]:[]);
 s.run("viewInicio=()=>shell('PRIVATE HOME');setDeviceLock({enabled:true,userId:'user',credentialId:'YQ'});lockDeviceNow()");
 await s.run('performDeviceUnlock()');await s.run('finishAuthenticated(state.user)');s.run('renderApp()');
 assert.match(s.root.innerHTML,/PRIVATE HOME/);assert.equal(s.intervals.size,1);
});
test('logout revokes only the current session and unsubscribes only this device',async()=>{
 const s=setup(),urls=[];let unsubscribed=0;
 s.ctx.fetch=async url=>{urls.push(url);return response({})};
 s.ctx.navigator.serviceWorker={getRegistration:async()=>({pushManager:{getSubscription:async()=>({endpoint:'https://push.example/current',unsubscribe:async()=>{unsubscribed++}})}})};
 s.run('logoutDevice()');await new Promise(r=>setImmediate(r));
 assert.equal(unsubscribed,1);
 assert(urls.some(u=>u.endsWith('/auth/v1/logout?scope=local')));
 assert(urls.some(u=>u.includes('/push_subscriptions?endpoint=eq.https%3A%2F%2Fpush.example%2Fcurrent')));
 assert(!urls.some(u=>u.includes('notification_preferences')));
});
