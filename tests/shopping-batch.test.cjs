const test=require('node:test'),assert=require('node:assert/strict'),B=require('../docs/shopping-batch.js'),Recovery=require('../docs/save-recovery.js');
const items=[{id:'milk',name:'Leche',quantity:'2 litros',favorite:true,note:'Entera',section:'Lácteos y huevos',updated_at:'v1'},{id:'kefir',name:'Kéfir',updated_at:'v1'},{id:'water',name:'Agua mineral',updated_at:'v1'},{id:'distilled',name:'Agua destilada',updated_at:'v1'}];
test('Spanish dictated lists separate quantities and natural conjunctions',()=>{
 assert.deepEqual(B.parse('Necesitamos dos botellas de agua, un kéfir, leche y huevos').map(x=>[x.name,x.quantity]),[['agua','2 botellas'],['kéfir','1'],['leche',''],['huevos','']]);
 assert.deepEqual(B.parse('1,5 litros de leche,2 huevos; pan 2 bolsas').map(x=>[x.name,x.quantity]),[['leche','1,5 litros'],['huevos','2'],['pan','2 bolsas']]);
});
test('pasted bullets, numbering, empty lines and category headings work',()=>{
 assert.deepEqual(B.parse('Lista de la compra:\nLácteos:\n1. Leche\n2. Kéfir\n\n- [ ] Pan\n• Agua').map(x=>x.name),['Leche','Kéfir','Pan','Agua']);
});
test('known compound products retain their conjunction',()=>{
 assert.deepEqual(B.parse('Champú y acondicionador, leche',[{name:'Champú y acondicionador'}]).map(x=>x.name),['Champú y acondicionador','leche']);
});
test('duplicates are merged without adding quantities and conflicts require review',()=>{
 assert.equal(B.parse('leche, Leche, pan').length,2);
 const rows=B.review('2 litros de leche,3 litros de leche',items);assert.ok(rows[0].warning);assert.equal(rows[0].quantity,'');
 assert.throws(()=>B.prepare(rows,items,'home',false,()=>''),/cantidad repetida/);
});
test('accent and familiar plural matches reuse an existing item, ambiguous choices stay open',()=>{
 const rows=B.review('kefir, leche, agua',items);assert.equal(rows[0].match,'kefir');assert.equal(rows[1].match,'milk');assert.equal(rows[2].match,'');
 assert.throws(()=>B.prepare(rows,items,'home',false,()=>''),/Elige/);
 assert.equal(B.review('dos yogures',[{id:'y',name:'Yogur'}])[0].match,'y');
 assert.equal(B.review('champú',[])[0].match,'new');
});
test('operations reuse IDs and preserve quantity and notes unless explicitly edited',()=>{
 const op=B.prepare(B.review('leche, pan',items),items,'home',false,()=> 'new-id');
 assert.equal(op[0].id,'milk');assert.equal(op[0].create,false);assert.equal(op[0].expected,'v1');assert.deepEqual(op[0].payload,{household_id:'home',purchased:false,archived:false});
 assert.equal(op[1].id,'new-id');assert.equal(op[1].payload.name,'pan');assert.equal(op[1].payload.favorite,false);
 const marked=B.prepare(B.review('3 litros de leche',items),items,'home',true,()=> 'x')[0];assert.equal(marked.payload.quantity,'3 litros');assert.equal(marked.payload.favorite,true);assert.equal(marked.payload.note,undefined);
});
test('edited duplicates, invalid selections, bounds and household scope are rejected',()=>{
 assert.throws(()=>B.parse(''));assert.throws(()=>B.parse('x'.repeat(6001)));assert.throws(()=>B.parse(Array.from({length:61},(_,i)=>'producto '+i).join(',')));
 assert.throws(()=>B.prepare([{name:'leche',match:'new',selected:true}],items,'home',false,()=>''),/ya está/);
 assert.throws(()=>B.prepare([],items,'home',false,()=>''),/Selecciona/);
 const rows=[...B.review('leche',items),...B.review('leche',items)];assert.throws(()=>B.prepare(rows,items,'home',false,()=>''),/dos filas/);
 const ops=B.prepare(B.review('pan',items),items,'home',false,()=> 'id');assert.equal(B.validOperations(ops,'other'),false);assert.equal(B.validOperations(ops,'home'),true);
});
test('partial completion checkpoints fixed operations and retries only pending products',async()=>{
 const operations=B.prepare(B.review('pan, huevos',[]),[],'home',false,(()=>{let i=0;return()=>String(++i)})());let fail=true,calls=[],checkpoints=[];
 const api={assert(){},persist:()=>checkpoints.push(JSON.stringify(operations)),apply(){},progress(){},save:async op=>{calls.push(op.id);if(op.id==='2'&&fail)throw Error('network');return {record:{id:op.id,household_id:'home'}}}};
 await assert.rejects(B.execute(operations,api),/network/);assert.equal(operations[0].done,true);assert.equal(operations[1].done,false);assert.equal(checkpoints.length,1);
 fail=false;await B.execute(operations,api);assert.deepEqual(calls,['1','2','2']);assert.ok(operations.every(o=>o.done));
});
test('a lost create reply is confirmed by stable ID before continuing the list',async()=>{
 const ops=B.prepare(B.review('pan',[]),[],'home',false,()=> 'id');let saved=null,writes=0;
 const api={assert(){},persist(){},apply(){},progress(){},save:op=>Recovery.save(op,{find:async()=>saved,write:async()=>{writes++;saved={id:'id',household_id:'home'};throw Error('lost reply')}})};
 await B.execute(ops,api);await B.execute(ops,api);assert.equal(writes,1);assert.equal(ops[0].done,true);
});
test('session change or foreign record cannot checkpoint or apply a batch result',async()=>{
 const ops=B.prepare(B.review('pan',[]),[],'home',false,()=> 'id');let active=true,persisted=0,applied=0;
 const api={assert:()=>{if(!active)throw Error('session')},persist:()=>persisted++,apply:()=>applied++,progress(){},save:async()=>{active=false;return {record:{id:'id',household_id:'home'}}}};
 await assert.rejects(B.execute(ops,api),/session/);assert.equal(persisted,0);assert.equal(applied,0);assert.equal(ops[0].done,false);
 active=true;api.save=async()=>({record:{id:'id',household_id:'other'}});await assert.rejects(B.execute(ops,api),/confirmar/);assert.equal(ops[0].done,false);
});
