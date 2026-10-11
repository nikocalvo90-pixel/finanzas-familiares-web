const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../docs/save-recovery.js');
const operation={resource:'family_tasks',household:'h',id:'new-id',create:true,payload:{household_id:'h',title:'Task'}};
const record={id:'new-id',household_id:'h',title:'Task',updated_at:'v1'};
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
test('drafts are isolated by user, household and form; pending writes never silently expire',()=>{
 const s=memory();S.write(s,'u','h','task',{form:{title:'Edited'},pending:operation},1);assert.equal(S.read(s,'u','h','task',100*86400000).pending.id,'new-id');assert.equal(S.read(s,'other','h','task'),null);assert.equal(S.read(s,'u','other','task'),null);assert.equal(S.read(s,'u','h','shopping'),null);
 S.write(s,'u','h','shopping',{form:{name:'Milk'}},1);assert.equal(S.read(s,'u','h','shopping',31*86400000),null);assert.throws(()=>S.write({setItem(){},getItem:()=>null},'u','h','task',{form:{}}),/conservar/);
});
test('a lost creation response recovers the same UUID, including after closing the form',async()=>{
 let saved=null,inserts=0;const api={find:async()=>saved,write:async()=>{inserts++;saved=record;throw Error('lost response')}};
 const first=await S.save(operation,api);assert.equal(first.existing,true);assert.equal(first.record.id,'new-id');await S.save(operation,api);assert.equal(inserts,1);
});
test('offline find failures never send an insert and retain its retry identity',async()=>{
 let writes=0;await assert.rejects(S.save(operation,{find:async()=>{throw Error('offline')},write:async()=>writes++}),/offline/);assert.equal(writes,0);assert.equal(operation.id,'new-id');
});
test('a delayed failed POST can be rechecked and retried with one database identity',async()=>{
 let writes=0;const error=Error('offline');const api={find:async()=>null,write:async()=>{writes++;if(writes===1)throw error;return [record]}};
 await assert.rejects(S.save(operation,api),/offline/);assert.equal((await S.save(operation,api)).record.id,'new-id');assert.equal(writes,2);
});
test('patch confirmation checks the requested values before repeating a task completion',async()=>{
 const op={...operation,create:false,expected:'old',payload:{household_id:'h',status:'HECHA'}};let writes=0;
 const r=await S.save(op,{find:async()=>({...record,status:'HECHA',updated_at:'changed'}),write:async()=>writes++});assert.equal(r.existing,true);assert.equal(writes,0);
});
test('a concurrent edit is never overwritten by a retry',async()=>{
 const op={...operation,create:false,expected:'old',payload:{household_id:'h',title:'Mine'}};let writes=0;
 await assert.rejects(S.save(op,{find:async()=>({...record,title:'Theirs',updated_at:'new'}),write:async()=>writes++}),e=>e.conflict);assert.equal(writes,0);
});
test('conditional patch failure remains a conflict rather than pretending to save',async()=>{
 const op={...operation,create:false,expected:'v1',payload:{household_id:'h',title:'Mine'}};
 await assert.rejects(S.save(op,{find:async()=>record,write:async()=>{throw S.conflict('Changed')}}),e=>e.conflict);
});
test('a lost PATCH response recovers its actual saved fields',async()=>{
 let current=record;const op={...operation,create:false,expected:'v1',payload:{household_id:'h',title:'Mine'}};
 const r=await S.save(op,{find:async()=>current,write:async()=>{current={...record,title:'Mine',updated_at:'v2'};throw Error('lost')}});assert.equal(r.existing,true);assert.equal(r.record.title,'Mine');
});
test('responses from another household are never accepted',async()=>{
 let writes=0;await assert.rejects(S.save(operation,{find:async()=>({...record,household_id:'foreign'}),write:async()=>writes++}),/otro hogar/);assert.equal(writes,0);
});
test('session cancellation stops recovery lookups and writes',async()=>{
 let active=true,writes=0,finds=0;
 await assert.rejects(S.save(operation,{assert:()=>{if(!active){const e=Error('cancelled');e.sessionCancelled=true;throw e}},find:async()=>{finds++;active=false;return null},write:async()=>writes++}),e=>e.sessionCancelled);assert.equal(writes,0);assert.equal(finds,1);
});
test('row actions keep the requested state and remain scoped across reloads',()=>{
 const s=memory(),op={...operation,create:false,payload:{household_id:'h',status:'HECHA'}};S.setActions(s,'u','h',[op]);assert.equal(S.actions(s,'u','h')[0].payload.status,'HECHA');assert.equal(S.actions(s,'other','h').length,0);assert.equal(S.actions(s,'u','other').length,0);S.setActions(s,'u','h',[]);assert.equal(S.actions(s,'u','h').length,0);
});
