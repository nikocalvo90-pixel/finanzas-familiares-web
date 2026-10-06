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
test('a queued logout event clears the view even if another tab already signed back in',()=>{
 const s=setup();s.run("saveSession({access_token:'new',user:{id:'user'}})");
 s.events.storage({key:s.run('STORE'),newValue:null});
 assert.equal(s.run('state.user'),null);assert.equal(s.run('state.data'),null);
 assert.equal(s.run('getSession().access_token'),'new');
});
test('a redirect session without a user profile cannot retain another account in the view',()=>{
 const s=setup();s.run("saveSession({access_token:'redirect',refresh_token:'redirect-refresh'})");
 s.events.storage({key:s.run('STORE'),newValue:'redirect-session'});
 assert.equal(s.run('state.user'),null);assert.equal(s.run('state.data'),null);
});
test('late refresh does not overwrite tokens saved by another tab',async()=>{
 const s=setup(),pending=deferred();s.ctx.fetch=()=>pending.promise;
 const result=s.run('refreshSession(getSession())');
 s.run("saveSession({access_token:'current-token',refresh_token:'current-refresh',user:{id:'user'}})");
 pending.resolve(response({access_token:'obsolete-token',refresh_token:'obsolete-refresh',user:{id:'user'}}));
 assert.equal((await result).access_token,'current-token');assert.equal(s.run('getSession().access_token'),'current-token');
});
test('a rejected obsolete refresh does not invalidate the current session',async()=>{
 const s=setup(),pending=deferred();s.ctx.fetch=()=>pending.promise;
 const result=s.run('refreshSession(getSession())');
 s.run("saveSession({access_token:'current-token',refresh_token:'current-refresh',user:{id:'user'}})");
 pending.resolve(response({message:'Refresh token revoked'},400));
 assert.equal((await result).access_token,'current-token');assert.equal(s.run('getSession().access_token'),'current-token');
});
test('recovery sessions cannot fetch financial data or navigate into the household',async()=>{
 const s=setup();s.run('saveSession({...getSession(),passwordRecovery:true})');
 assert.equal(s.run('privateAccess()'),false);
 await assert.rejects(s.run("authed('/rest/v1/transactions')"),e=>e.sessionCancelled===true);
 await assert.rejects(s.run('loadAll(true)'),e=>e.sessionCancelled===true);
 s.run('renderApp()');assert.match(s.root.innerHTML,/Elige una nueva contraseña/);assert.doesNotMatch(s.root.innerHTML,/private/);
});
test('token renewal keeps a recovery session restricted',async()=>{
 const s=setup();s.run('saveSession({...getSession(),passwordRecovery:true})');s.ctx.fetch=async()=>response({access_token:'renewed',refresh_token:'new-refresh',user:{id:'user'}});
 await s.run('refreshSession(getSession())');assert.equal(s.run('getSession().passwordRecovery'),true);assert.equal(s.run('privateAccess()'),false);
});
test('password change reauthenticates and uses the verified session for the write',async()=>{
 const s=setup(),calls=[];s.ctx.fetch=async(url,opt)=>{calls.push({url,body:JSON.parse(opt.body||'{}'),authorization:opt.headers.Authorization});return url.includes('grant_type=password')?response({access_token:'verified',refresh_token:'verified-refresh',user:{id:'user'}}):response({id:'user'})};
 await s.run("updateAccountPassword('example-new','example-current')");assert.equal(calls[0].body.password,'example-current');assert.equal(calls[1].authorization,'Bearer verified');assert.deepEqual(calls[1].body,{password:'example-new'});
});
test('wrong current password never issues a password update',async()=>{
 const s=setup();let calls=0;s.ctx.fetch=async()=>{calls++;return response({message:'Invalid login credentials'},400)};
 await assert.rejects(s.run("updateAccountPassword('example-new','wrong')"),/verificar/);assert.equal(calls,1);assert.equal(s.run('getSession().access_token'),'token');
});
test('a late reauthentication cannot restore a logged out session',async()=>{
 const s=setup(),pending=deferred();s.ctx.fetch=()=>pending.promise;const result=s.run("updateAccountPassword('example-new','current')");s.run('logoutDevice()');pending.resolve(response({access_token:'late',refresh_token:'late-refresh',user:{id:'user'}}));await assert.rejects(result,e=>e.sessionCancelled===true);assert.equal(s.run('getSession()'),null);
});
test('family invitations show all live codes and hide closed codes',()=>{
 const s=setup();s.run("state.member={role:'OWNER'};state.data.invites=Array.from({length:12},(_,i)=>({id:'i'+i,code:'LIVE'+i,uses:0,max_uses:1,expires_at:'2099-01-01'}));state.data.invites.push({id:'closed',code:'SECRET-CLOSED',revoked_at:'2026-01-01',created_at:'2026-01-01',uses:0,max_uses:1})");
 const panel=s.run('familyInvitationsPanel()');assert.match(panel,/LIVE11/);assert.doesNotMatch(panel,/SECRET-CLOSED/);assert.match(panel,/Cancelada/);
 s.run("state.member.role='MEMBER'");assert.doesNotMatch(s.run('familyInvitationsPanel()'),/LIVE|data-cancel-family-invite|new-invite/);
 assert.equal(s.run("invitationStatus({uses:0,max_uses:1,expires_at:'2000-01-01'})"),'Caducada');
 assert.equal(s.run("invitationStatus({uses:1,max_uses:1,expires_at:'2099-01-01'})"),'Utilizada');
});
test('invitation cancellation scopes its write and requires a confirmed result',async()=>{
 const s=setup();s.run("state.member={role:'OWNER'};state.data.invites=[{id:'invite',code:'CODE',uses:0,max_uses:1,expires_at:'2099-01-01'}]");let request;
 s.ctx.fetch=async(url,opt)=>{request={url,opt};return response([{id:'invite',revoked_at:'2026-01-01'}])};
 await s.run("revokeFamilyInvitation('invite')");assert.match(request.url,/id=eq.invite&household_id=eq.household&revoked_at=is.null/);assert.equal(request.opt.method,'PATCH');assert.deepEqual(Object.keys(JSON.parse(request.opt.body)),['revoked_at']);assert.equal(s.run("state.data.invites[0].revoked_at"),'2026-01-01');
 s.run("state.data.invites[0]={id:'invite',uses:0,max_uses:1,expires_at:'2099-01-01'}");s.ctx.fetch=async()=>response([]);
 await assert.rejects(s.run("revokeFamilyInvitation('invite')"),/confirmar la cancelación/);assert.equal(s.run('state.data.invites[0].revoked_at'),undefined);
 s.run("state.member.role='MEMBER'");let writes=0;s.ctx.fetch=async()=>{writes++;return response([])};
 await assert.rejects(s.run("revokeFamilyInvitation('invite')"),/propietario/);assert.equal(writes,0);
});
test('late invitation cancellation cannot mutate a later session',async()=>{
 const s=setup(),pending=deferred();s.run("state.member={role:'OWNER'};state.data.invites=[{id:'invite',uses:0,max_uses:1,expires_at:'2099-01-01'}]");s.ctx.fetch=()=>pending.promise;
 const result=s.run("revokeFamilyInvitation('invite')");s.run("logoutDevice();state.data={invites:[{id:'invite',code:'NEW'}]}");pending.resolve(response([{id:'invite',revoked_at:'2026-01-01'}]));
 await assert.rejects(result,e=>e.sessionCancelled===true);assert.equal(s.run('state.data.invites[0].code'),'NEW');
});
