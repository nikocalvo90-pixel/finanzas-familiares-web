const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {Worker:NodeWorker}=require('node:worker_threads');
const XLSX=require('../docs/vendor/xlsx-0.20.3.full.min.js');
const excelContext=vm.createContext({self:{},TextDecoder});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../docs/bank-excel-worker.js'),'utf8'),excelContext);
const readExcel=bytes=>vm.runInContext('bankExcelSheets',excelContext)(bytes,XLSX);
// In-memory serialization fixtures exercise the real binary codecs; nothing is uploaded.
function excelBytes(rows,bookType='xlsx',date1904=false,extraSheets=[]){
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Movimientos');
  for(const [name,data] of extraSheets)XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),name);
  wb.Workbook={WBProps:{date1904}};
  return XLSX.write(wb,{bookType,type:'array'});
}

const html=fs.readFileSync(require('node:path').join(__dirname,'../docs/index.html'),'utf8');
const source=html.slice(html.indexOf('function bankParseCsv('),html.indexOf('function toast(msg)'))+
  html.slice(html.indexOf('async function bankBuildRows('),html.indexOf('function transactionById('));
const expense='00000000-0000-0000-0000-000000000001';
const income='00000000-0000-0000-0000-000000000002';
const account='00000000-0000-0000-0000-000000000003';
const ctx=vm.createContext({
  crypto:webcrypto,TextEncoder,TextDecoder,setTimeout,clearTimeout,APP_BUILD:'20260927.3',
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

test('unquoted decimal commas cannot silently change an imported amount',async()=>{
  const csv='Fecha,Concepto,Importe\n27/09/2026,Super,-18,50\n28/09/2026,Super,-5.00';
  const rows=await run('bankBuildRows')(run('bankReadCsv')(csv),account,snapshot());
  assert.match(rows[0].error,/columnas no coincide/);
  assert.equal(rows[0].selected,false);
  assert.equal(rows[1].amount,5);
  const ambiguous=run('bankReadCsv')('Fecha,Concepto,Importe\n27/09/2026,Super,-18,50\n28/09/2026,Entrada,5.00');
  await assert.rejects(run('bankBuildRows')(ambiguous,account,snapshot()),/sin signo/);
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

for(const format of ['xls','xlsx']){
  test(format+' preserves dates, signed cents, accents and stable IDs across CSV and Excel',async()=>{
    const serial=(Date.UTC(2026,8,27)-Date.UTC(1899,11,30))/86400000;
    const bytes=excelBytes([
      ['Extracto bancario'],[],['Cuenta de prueba'],
      ['F. VALOR','DESCRIPCIÓN','IMPORTE (€)','SALDO (€)','Referencia'],
      [serial,'Super España',-1234.56,2800,'001234'],
      ['28/09/2026','Nómina',2000,4800,'A2']
    ],format);
    assert.equal(new Uint8Array(bytes)[0],format==='xls'?0xd0:0x50);
    const choices=run('bankReadExcelSheets')(readExcel(bytes));
    assert.equal(choices.length,1);
    const rows=await run('bankBuildRows')(choices[0].parsed,account,snapshot());
    assert.equal(rows.length,2);
    assert.equal(rows[0].line,5);
    assert.equal(rows[0].date,'2026-09-27');
    assert.equal(rows[0].signed,-1234.56);
    assert.equal(rows[0].concept,'Super España');
    assert.equal(rows[1].date,'2026-09-28');
    assert.equal(rows[1].signed,2000);
    assert.equal(rows[0].error,'');
    const csv=run('bankReadCsv')('Fecha;Concepto;Importe;Referencia\n27/09/2026;Super España;-1.234,56;001234\n28/09/2026;Nómina;+2000,00;A2');
    const csvRows=await run('bankBuildRows')(csv,account,snapshot());
    assert.equal(rows[0].externalId,csvRows[0].externalId);
    const prior=snapshot();prior.ids.add(csvRows[0].externalId);
    run('bankApplySnapshot')(rows,prior);
    assert.equal(rows[0].existingExact,true);
    assert.equal(rows[0].selected,false);
  });
}

test('Excel dates support the 1904 epoch and reject the imaginary 1900 leap day',async()=>{
  const serial=(Date.UTC(2026,8,27)-Date.UTC(1904,0,1))/86400000;
  const choices=run('bankReadExcelSheets')(readExcel(excelBytes([
    ['Fecha','Concepto','Importe'],[serial+.75,'Super',-18]
  ],'xlsx',true)));
  const rows=await run('bankBuildRows')(choices[0].parsed,account,snapshot());
  assert.equal(rows[0].date,'2026-09-27');
  assert.equal(run('bankDate')(60),null);
  assert.equal(run('bankDate')(0),null);
  assert.equal(run('bankDate')(0,true),'1904-01-01');
});

test('Excel numeric amounts cannot be reinterpreted as thousands',async()=>{
  const choices=run('bankReadExcelSheets')(readExcel(excelBytes([
    ['Fecha','Concepto','Importe'],['27/09/2026','Super',-1.234],['27/09/2026','Super',-12.34]
  ])));
  const rows=await run('bankBuildRows')(choices[0].parsed,account,snapshot());
  assert.match(rows[0].error,/Importe/);
  assert.equal(rows[0].selected,false);
  assert.equal(rows[1].signed,-12.34);
  assert.equal(run('bankAmount')(NaN),null);
  assert.equal(run('bankAmount')(Infinity),null);
});

test('HTML and SpreadsheetML with an XLS extension preserve Spanish date and amount text',async()=>{
  const html='<html><body><table><tr><td>Extracto</td></tr><tr><td>Fecha</td><td>Concepto</td><td>Importe</td></tr><tr><td>03/04/2026</td><td>Super España</td><td>-1.234,56</td></tr></table></body></html>';
  const bytes=new TextEncoder().encode(html).buffer;
  const choices=run('bankReadExcelSheets')(readExcel(bytes));
  const rows=await run('bankBuildRows')(choices[0].parsed,account,snapshot());
  assert.equal(rows[0].date,'2026-04-03');
  assert.equal(rows[0].signed,-1234.56);
  assert.equal(rows[0].concept,'Super España');
  const xml=excelBytes([['Fecha','Concepto','Importe'],['03/04/2026','Super',-12.34]],'xlml');
  const xmlRows=await run('bankBuildRows')(run('bankReadExcelSheets')(readExcel(xml))[0].parsed,account,snapshot());
  assert.equal(xmlRows[0].date,'2026-04-03');
  assert.equal(xmlRows[0].signed,-12.34);
});

test('multiple sheets are returned separately and empty cover sheets are not selected',()=>{
  const table=[['Fecha','Concepto','Importe'],['27/09/2026','Super',-18]];
  const bytes=excelBytes([['Portada']],'xlsx',false,[['Cuenta 1',table],['Cuenta 2',table]]);
  const choices=run('bankReadExcelSheets')(readExcel(bytes));
  assert.deepEqual(Array.from(choices,s=>s.name),['Cuenta 1','Cuenta 2']);
});

test('oversized, empty, unrecognized and encrypted sheets fail without partial import',async()=>{
  const table=[['Fecha','Concepto','Importe'],...Array.from({length:501},()=>['27/09/2026','Super',-18])];
  const choices=run('bankReadExcelSheets')(readExcel(excelBytes(table)));
  await assert.rejects(run('bankBuildRows')(choices[0].parsed,account,snapshot()),/500/);
  const empty=run('bankReadExcelSheets')(readExcel(excelBytes([table[0]])));
  await assert.rejects(run('bankBuildRows')(empty[0].parsed,account,snapshot()),/no contiene/);
  assert.throws(()=>run('bankReadExcelSheets')(readExcel(excelBytes([['Solo resumen']]))),/No se reconocen/);
  const huge=readExcel(excelBytes([...table,...Array.from({length:1551},()=>['27/09/2026','Super',-18])]));
  assert.match(huge[0].error,/demasiado grande/);
  assert.throws(()=>vm.runInContext('bankExcelSheets',excelContext)(new ArrayBuffer(1),{read(){throw new Error('File is password-protected')}}),/contraseña/);
});

test('Excel retains the unsigned-only safeguard and validates both Debe/Haber cells',async()=>{
  const unsigned=run('bankReadExcelSheets')(readExcel(excelBytes([['Fecha','Concepto','Importe'],['27/09/2026','Super',18]])));
  await assert.rejects(run('bankBuildRows')(unsigned[0].parsed,account,snapshot()),/sin signo/);
  const choices=run('bankReadExcelSheets')(readExcel(excelBytes([
    ['Fecha','Concepto','Debe','Haber'],['27/09/2026','Super',18,0],['27/09/2026','Nómina',0,2000],['27/09/2026','Super','inválido',20]
  ])));
  const rows=await run('bankBuildRows')(choices[0].parsed,account,snapshot());
  assert.equal(rows[0].signed,-18);
  assert.equal(rows[1].signed,2000);
  assert.match(rows[2].error,/Debe\/Haber/);
  assert.equal(rows[2].selected,false);
});

test('file selection runs the complete standalone browser parser through a disposable worker',async()=>{
  let terminated=false;
  ctx.Worker=class{
    constructor(url){
      assert.equal(url,'./bank-excel-worker.js?v=20260927.3');
      this.worker=new NodeWorker(`
        const {parentPort,workerData}=require('node:worker_threads');
        const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
        const scope=vm.createContext({TextDecoder,ArrayBuffer,Uint8Array});
        scope.self=scope;
        scope.postMessage=data=>parentPort.postMessage(data);
        scope.importScripts=name=>vm.runInContext(fs.readFileSync(path.join(workerData,name),'utf8'),scope);
        vm.runInContext(fs.readFileSync(path.join(workerData,'bank-excel-worker.js'),'utf8'),scope);
        parentPort.on('message',data=>scope.onmessage({data}));
      `,{eval:true,workerData:require('node:path').join(__dirname,'../docs')});
      this.worker.on('message',data=>this.onmessage({data}));
      this.worker.on('error',error=>this.onerror(error));
    }
    postMessage(data,transfer){this.worker.postMessage(data,transfer)}
    terminate(){terminated=true;this.worker.terminate()}
  };
  const bytes=excelBytes([['Fecha','Concepto','Importe'],['27/09/2026','Super',-18]],'xls');
  const choices=await run('bankReadFile')({name:'ING.XLS',arrayBuffer:async()=>bytes});
  const rows=await run('bankBuildRows')(choices[0].parsed,account,snapshot());
  assert.equal(rows[0].date,'2026-09-27');
  assert.equal(rows[0].signed,-18);
  assert.equal(terminated,true);
  assert.equal(bytes.byteLength,0,'file buffer transfers to worker instead of copying');
  await assert.rejects(run('bankReadFile')({name:'extracto.pdf'}),/CSV, XLS o XLSX/);
  const csv=await run('bankReadFile')({name:'extracto.csv',arrayBuffer:async()=>new TextEncoder().encode('Fecha;Concepto;Importe\n27/09/2026;Super;-18').buffer});
  assert.equal(csv[0].parsed.entries.length,1);
});
