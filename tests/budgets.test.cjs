const test=require('node:test'),assert=require('node:assert/strict'),B=require('../docs/budgets.js');
const month='2026-10',today='2026-10-12',budget=(category_id,amount)=>({id:category_id,category_id,amount,month:month+'-01'}),tx=(category_id,amount,type='GASTO',date=today)=>({category_id,amount,type,transaction_date:date});
test('monthly limits parse Spanish amounts accurately and accept an explicit zero',()=>{
 assert.equal(B.limit('1.200,50 €'),1200.5);assert.equal(B.limit('1200.50'),1200.5);assert.equal(B.limit('0'),0);assert.equal(B.cents(.29),29);
 for(const s of ['','-10','1,234','1,2,3','abc','10000001'])assert.throws(()=>B.limit(s));
});
test('current month compares equal day cutoffs, including short previous months and year changes',()=>{
 const r=B.periods(month,today);assert.equal(r.current.to,today);assert.equal(r.previous.to,'2026-09-12');
 assert.equal(B.periods('2024-03','2024-03-31').previous.to,'2024-02-29');
 assert.equal(B.periods('2026-01','2026-01-12').previous.from,'2025-12-01');
 const past=B.periods('2026-08',today);assert.equal(past.current.to,'2026-08-31');assert.equal(past.previous.to,'2026-07-31');assert.equal(past.partial,false);
 assert.throws(()=>B.bounds('2026-13'));
});
test('net category spending deducts refunds and excludes investments, transfers and future current-month rows',()=>{
 const r=B.report([budget('food',100)],[tx('food',90),tx('food',20,'DEVOLUCION'),tx('food',100,'INVERSION'),tx('food',50,'TRANSFERENCIA_INTERNA'),tx('food',15,'GASTO','2026-10-20')],[{id:'food',name:'Comida'}],month,today);
 assert.equal(r.spent,7000);assert.equal(r.remaining,3000);assert.equal(r.limited[0].status,'ok');
});
test('thresholds distinguish near, reached, exceeded and a zero-spend limit',()=>{
 const r=B.report([budget('a',100),budget('b',100),budget('c',100),budget('d',0)],[tx('a',80),tx('b',100),tx('c',120),tx('d',1)],[],month,today);
 assert.deepEqual(r.limited.map(x=>x.status),['near','reached','over','over']);assert.equal(r.alerts.length,4);
 assert.equal(B.report([budget('d',0)],[],[],month,today).limited[0].status,'ok');
});
test('unbudgeted expenses stay outside the available amount and unknown categories remain visible',()=>{
 const r=B.report([budget('a',100)],[tx('a',20),tx('other',500),tx(null,10)],[],month,today);
 assert.equal(r.remaining,8000);assert.equal(r.withoutLimit,51000);assert.equal(r.unlimited.length,2);assert.ok(r.unlimited.some(x=>x.name==='Sin categoría'));
});
test('previous-period comparisons ignore later previous days and do not invent a percentage from zero',()=>{
 const r=B.report([budget('a',100)],[tx('a',70),tx('a',40,'GASTO','2026-09-08'),tx('a',999,'GASTO','2026-09-20')],[],month,today).limited[0];
 assert.equal(r.previous,4000);assert.equal(r.delta,3000);assert.equal(r.percent,75);
 assert.equal(B.report([budget('a',100)],[tx('a',5)],[],month,today).limited[0].percent,null);
});
test('refund-only spending is shown accurately and duplicate fetched IDs are counted once',()=>{
 const r=B.report([budget('a',100)],[{id:'refund',...tx('a',20,'DEVOLUCION')},{id:'refund',...tx('a',20,'DEVOLUCION')}],[],month,today);
 assert.equal(r.spent,-2000);assert.equal(r.remaining,12000);assert.equal(r.limited[0].ratio,0);
});
test('another month cannot supply a limit; duplicate limits and nonfinite amounts fail visibly',()=>{
 assert.equal(B.report([{...budget('a',100),month:'2026-09-01'}],[],[],month,today).limited.length,0);
 assert.throws(()=>B.report([budget('a',100),budget('a',200)],[],[],month,today),/duplicados/);
 assert.throws(()=>B.report([budget('a',100)],[tx('a',NaN)],[],month,today));
});
