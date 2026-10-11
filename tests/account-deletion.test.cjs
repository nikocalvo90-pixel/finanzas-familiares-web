const test=require('node:test');const assert=require('node:assert/strict');
const user={id:'self',email:'self@synthetic.invalid'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function fixture(overrides={}){
 const {createHandler}=await import('../supabase/functions/delete-account/handler.mjs');const calls=[];
 const handler=createHandler({url:'https://auth.invalid',anonKey:'public',serviceKey:'server-only',fetcher:async(url,opt)=>{
  const body=opt.body?JSON.parse(opt.body):null;calls.push({url,opt,body});
  if(overrides.fetch)return overrides.fetch(url,opt,body);
  if(url.endsWith('/auth/v1/user'))return json(overrides.caller||user,overrides.callerStatus||200);
  if(url.includes('household_members'))return json(overrides.owners||[]);
  if(url.includes('grant_type=password'))return json(overrides.verification||{access_token:'fresh',user},overrides.passwordStatus||200);
  if(url.includes('/admin/users/'))return json({},overrides.deleteStatus||200);
  return json({});
 }});
 const invoke=(body={password:'synthetic-password',confirmation:'ELIMINAR'},headers={},method='POST')=>handler(new Request('https://edge.invalid/delete-account',{method,headers:{Authorization:'Bearer original','Content-Type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
 return {calls,invoke};
}
test('deletion verifies server identity and password before soft-deleting only the caller',async()=>{
 const f=await fixture();const res=await f.invoke({password:'synthetic-password',confirmation:'ELIMINAR',user_id:'victim'});assert.equal(res.status,200);assert.deepEqual(await res.json(),{message:'Tu cuenta de Casuo se ha eliminado.',deleted:true,user_id:'self'});
 const verify=f.calls.find(x=>x.url.includes('grant_type'));assert.deepEqual(verify.body,{email:user.email,password:'synthetic-password'});assert.equal(verify.opt.headers.apikey,'public');
 const del=f.calls.find(x=>x.url.includes('/admin/users/'));assert.match(del.url,/\/self$/);assert.deepEqual(del.body,{should_soft_delete:true});assert.equal(del.opt.headers.apikey,'server-only');assert.equal(f.calls.at(-1).opt.headers.Authorization,'Bearer fresh');
});
test('an owner is blocked before any password authentication or deletion',async()=>{
 const f=await fixture({owners:[{household_id:'owned'}]});assert.equal((await f.invoke()).status,409);assert.equal(f.calls.length,2);
});
test('wrong password and rate limits cannot delete a user',async()=>{
 for(const status of [400,429]){const f=await fixture({passwordStatus:status});assert.equal((await f.invoke()).status,status);assert.equal(f.calls.some(x=>x.url.includes('/admin/')),false)}
});
test('server rejects missing credentials, malformed confirmation and untrusted origins',async()=>{
 const f=await fixture();assert.equal((await f.invoke({},{})).status,400);assert.equal((await f.invoke(undefined,{Authorization:''})).status,401);assert.equal((await f.invoke(undefined,{Origin:'https://attacker.invalid'})).status,403);assert.equal(f.calls.length,0);
});
test('verified credentials for another user never authorize deleting either account',async()=>{
 const f=await fixture({verification:{access_token:'other-token',user:{id:'victim'}}});assert.equal((await f.invoke()).status,403);assert.equal(f.calls.some(x=>x.url.includes('/admin/')),false);
});
test('deleted and expired callers cannot reach privileged deletion',async()=>{
 for(const settings of [{callerStatus:401},{caller:{...user,deleted_at:'2026-01-01'}}]){const f=await fixture(settings);assert.equal((await f.invoke()).status,401);assert.equal(f.calls.length,1)}
});
test('an atomic deletion rejection cleans up the extra password session and reports no success',async()=>{
 const f=await fixture({deleteStatus:500});const res=await f.invoke();assert.equal(res.status,409);assert.equal((await res.json()).deleted,undefined);assert.match(f.calls.at(-1).url,/logout\?scope=local/);
});
test('connection failures never leak credentials or server errors',async()=>{
 const f=await fixture({fetch:()=>{throw Error('server-only secret')}});const res=await f.invoke();assert.equal(res.status,503);assert.doesNotMatch(await res.text(),/server-only|synthetic-password/);
});
test('preflight allows the app origin without calling Auth',async()=>{
 const f=await fixture();const res=await f.invoke(undefined,{Origin:'https://casuo.es'},'OPTIONS');assert.equal(res.status,204);assert.equal(res.headers.get('Access-Control-Allow-Origin'),'https://casuo.es');assert.equal(f.calls.length,0);
});
