const test=require('node:test');
const assert=require('node:assert/strict');
const routing=()=>import('../supabase/functions/family-notifications/routing.mjs');
const event={id:'event',household_id:'home-a',user_id:'user'};
const sub={id:'device',household_id:'home-a',user_id:'user',endpoint:'https://push.invalid/device',p256dh:'key',auth_key:'auth'};
const pref={household_id:'home-a',user_id:'user',push_enabled:true};
function backend(overrides={}){
 const rows={notification_events:[event],notification_preferences:[pref],push_subscriptions:[sub],household_members:[event],...overrides};
 return async path=>{assert.match(path,/household_id=eq.home-a&user_id=eq.user/);return rows[path.split('?')[0]]};
}
test('another household opt-in and device never enable this household',async()=>{
 const {eligibleTargets}=await routing();
 assert.deepEqual(eligibleTargets(event,[{...pref,household_id:'home-b'}],[sub]),[]);
 assert.deepEqual(eligibleTargets(event,[pref],[{...sub,household_id:'home-b'}]),[]);
 assert.deepEqual(eligibleTargets(event,[pref],[{...sub,user_id:'other'}]),[]);
 assert.deepEqual(eligibleTargets(event,[pref],[sub]),[sub]);
});
test('fresh membership is required even with an old queued event and subscription',async()=>{
 const {stillEligible}=await routing();
 assert.equal(await stillEligible(event,sub,backend()),true);
 assert.equal(await stillEligible(event,sub,backend({household_members:[]})),false);
});
test('opt-out, dismissed event and disabled device stop queued delivery',async()=>{
 const {stillEligible}=await routing();
 for(const table of ['notification_preferences','notification_events','push_subscriptions'])assert.equal(await stillEligible(event,sub,backend({[table]:[]})),false);
 assert.equal(await stillEligible(event,sub,backend({notification_preferences:[{...pref,push_enabled:false}]})),false);
});
test('foreign rows or replaced device keys fail closed',async()=>{
 const {stillEligible}=await routing();
 assert.equal(await stillEligible(event,sub,backend({household_members:[{...event,household_id:'home-b'}]})),false);
 assert.equal(await stillEligible(event,sub,backend({push_subscriptions:[{...sub,auth_key:'changed'}]})),false);
});
test('membership is rechecked for each device and lookup failure never authorizes',async()=>{
 const {stillEligible}=await routing();let active=true;
 const query=async p=>p.startsWith('household_members?')?(active?[event]:[]):backend()(p);
 assert.equal(await stillEligible(event,sub,query),true);active=false;
 assert.equal(await stillEligible(event,sub,query),false);
 await assert.rejects(stillEligible(event,sub,async()=>{throw Error('network')}),/network/);
});
