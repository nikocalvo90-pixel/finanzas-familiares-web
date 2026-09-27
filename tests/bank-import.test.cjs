const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');

const html=fs.readFileSync(require('node:path').join(__dirname,'../docs/index.html'),'utf8');
const source=html.slice(html.indexOf('function bankParseCsv('),html.indexOf('function toast(msg)'))+
  html.slice(html.indexOf('async function bankBuildRows('),html.indexOf('function transactionById('));
const expense='00000000-0000-0000-0000-000000000001';
const income='00000000-0000-0000-0000-000000000002';
const account='00000000-0000-0000-0000-000000000003';
const ctx=vm.createContext({
  crypto:webcrypto,TextEncoder,
  norm:s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim(),
  state:{data:{
    transactions:[],
    categories:[{id:expense,name:'Alimentación',kind:'GASTO'},{id:income,name:'Otros ingresos',kind:'INGRESO'}]
  }},
  historicalSuggestion:()=>null,
  interpretNatural:concept=>concept.toLowerCase().includes('super')
    ?{type:'GASTO',category_id:expense,confidence:.96,reason:'Comercio reconocido'}
    :{type:'INGRESO',category_id:income,confidence:.55,reason:'Revisar'}
});
vm.runInContext(source,ctx);
const run=(expression)=>vm.runInContext(expression,ctx);
const snapshot=()=>({ids:new Set(),matches:new Set(),closed:new Set()});

test('quoted delimiters, line breaks and preamble are read without losing a transaction',()=>{
  const parsed=run('bankReadCsv')('sep=;\nFecha;Concepto;Importe;Referencia\n27/09/2026;"Super, ""Dos""";-1.234,50;A1\n28/09/2026;"Super\nMercado";+12,30;A2');
  assert.equal(parsed.entries.length,2);
  assert.equal(parsed.entries[0].cells[1],'Super, "Dos"');
  assert.equal(parsed.entries[1].cells[1],'Super\nMercado');
  assert.equal(run('bankAmount')('1.234,50-').amount,1234.5);
  assert.equal(run('bankAmount')('1.234,50-').sign,-1);
});

test('European amounts and dates are validated strictly',()=>{
  assert.equal(run('bankDate')('31/02/2026'),null);
  assert.equal(run('bankDate')('2026-09-27 12:01'),'2026-09-27');
  assert.equal(run('bankDate')('27.09.2026'),'2026-09-27');
  assert.equal(run('bankAmount')('1,234'),null);
  assert.equal(run('bankAmount')('1.234,56 €').amount,1234.56);
  assert.equal(run('bankAmount')('1.234').amount,1234);
  assert.equal(run('bankAmount')('0,00'),null);
});

test('unsigned all-positive amounts are rejected, but Debe/Haber supplies direction',async()=>{
  const signed=run('bankReadCsv')('Fecha,Concepto,Importe\n27/09/2026,Super,12.30');
  await assert.rejects(run('bankBuildRows')(signed,account,snapshot()),/sin signo/);
  const split=run('bankReadCsv')('Fecha;Concepto;Debe;Haber\n27/09/2026;Super;24,00;\n28/09/2026;Nómina;;2000,00');
  const rows=await run('bankBuildRows')(split,account,snapshot());
  assert.equal(rows[0].signed,-24);
  assert.equal(rows[1].signed,2000);
  assert.equal(rows[0].selected,true);
  assert.equal(rows[1].selected,false);
});

test('external IDs are stable, bank references distinguish charges and repeats start unchecked',async()=>{
  const csv='Fecha;Concepto;Importe;Referencia\n27/09/2026;Super;-18,00;ABC\n27/09/2026;Super;-18,00;DEF\n27/09/2026;Super;-18,00;ABC';
  const first=await run('bankBuildRows')(run('bankReadCsv')(csv),account,snapshot());
  const again=await run('bankBuildRows')(run('bankReadCsv')(csv),account,snapshot());
  assert.equal(first[0].externalId,again[0].externalId);
  assert.notEqual(first[0].externalId,first[1].externalId);
  assert.notEqual(first[0].externalId,first[2].externalId);
  assert.equal(first[2].repeated,true);
  assert.equal(first[2].selected,false);
  const previous=snapshot();
  previous.ids.add(first[0].externalId);
  previous.closed.add('2026-09');
  run('bankApplySnapshot')(first,previous);
  assert.equal(first[0].selected,false);
  assert.match(run('bankRowProblem')(first[1],previous.closed),/cerrado/);
});

test('probable manual duplicates are excluded and opposite direction cannot be confirmed',async()=>{
  const parsed=run('bankReadCsv')('Fecha;Concepto;Importe\n27/09/2026;Super;-18,00');
  const prior=snapshot();
  prior.matches.add(run('bankExistingKey')(account,'2026-09-27',18,'GASTO','Super'));
  const rows=await run('bankBuildRows')(parsed,account,prior);
  assert.equal(rows[0].probable,true);
  assert.equal(rows[0].selected,false);
  rows[0].type='INGRESO';
  assert.match(run('bankRowProblem')(rows[0],prior.closed),/tipo no coincide/);
});
