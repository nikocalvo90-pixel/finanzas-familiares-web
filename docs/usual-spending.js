(function(root){
'use strict';
function cents(value){const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('Importe no válido.');return Math.round(n*100)}
function month(value){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)||Number(value.slice(0,4))<1900)throw Error('Mes no válido.');return value}
function shift(value,n){month(value);const d=new Date(Date.UTC(Number(value.slice(0,4)),Number(value.slice(5))-1+n,1));return d.toISOString().slice(0,7)}
function periods(today,count=12){const current=month(today.slice(0,7));return Array.from({length:count},(_,i)=>shift(current,i-count+1))}
function report(feed,selected,today,periodized=true){
 const current=month(today.slice(0,7)),chosen=[...new Set(selected.map(month))].sort();if(chosen.some(m=>m>=current))throw Error('Selecciona solo meses ya terminados.');
 const rows=new Map(),tx=new Map(feed.transactions.map(t=>[t.id,t])),schedules=new Map();
 for(const s of feed.schedules||[])if(s.active){if(schedules.has(s.transaction_id))throw Error('Hay periodizaciones duplicadas para un movimiento.');schedules.set(s.transaction_id,s)}
 const get=m=>{month(m);if(!rows.has(m))rows.set(m,{month:m,net:0,excluded:0,usual:0,cash:0,bank:0,unknown:0,missing:0,count:0});return rows.get(m)};
 const account=new Map((feed.accounts||[]).map(a=>[a.id,a]));
 const excluded=t=>!!t.exclude_from_normalized||!!tx.get(t.reimburses_transaction_id)?.exclude_from_normalized;
 const add=(t,m,amount)=>{if(m>current)return;const r=get(m);r.usual+=amount;const a=account.get(t.account_id);r[a?(a.type==='EFECTIVO'?'cash':'bank'):'unknown']+=amount};
 for(const t of tx.values()){
  if(!['GASTO','DEVOLUCION'].includes(t.type)||t.transaction_date>today)continue;
  const amount=cents(t.amount)*(t.type==='DEVOLUCION'?-1:1),m=month(t.transaction_date.slice(0,7)),r=get(m);r.net+=amount;r.count++;if(!account.has(t.account_id))r.missing++;
  if(excluded(t)){r.excluded+=amount;continue}if(!periodized||!schedules.has(t.id))add(t,m,amount);
 }
 if(periodized)for(const a of feed.allocations||[]){const s=(feed.schedules||[]).find(s=>s.id===a.schedule_id&&s.active),t=s&&tx.get(s.transaction_id);if(!t||excluded(t)||!['GASTO','DEVOLUCION'].includes(t.type)||t.transaction_date>today)continue;add(t,month(a.period_month.slice(0,7)),cents(a.amount)*(t.type==='DEVOLUCION'?-1:1))}
 // A missing allocation must never silently erase a scheduled expense.
 if(periodized)for(const [id,s] of schedules){const t=tx.get(id);if(t&&!excluded(t)&&['GASTO','DEVOLUCION'].includes(t.type)&&t.transaction_date<=today&&!(feed.allocations||[]).some(a=>a.schedule_id===s.id))throw Error('Hay un reparto sin cuotas. Revisa las periodizaciones antes de calcular.');}
 const included=chosen.map(get),sum=k=>included.reduce((n,r)=>n+r[k],0),avg=k=>included.length?sum(k)/included.length:null;
 return {months:[...rows.values()].sort((a,b)=>b.month.localeCompare(a.month)),selected:chosen,average:avg('usual'),cash:avg('cash'),bank:avg('bank'),unknown:avg('unknown'),excluded:sum('excluded'),missing:sum('missing'),periodized};
}
function accountOperations(items,ids,account,household,closed){
 if(!account||account.household_id!==household||account.is_archived)throw Error('Selecciona una cuenta activa del hogar.');
 if(!ids.length||ids.length>100)throw Error('Selecciona entre 1 y 100 movimientos por lote.');
 const wanted=new Set(ids);if(wanted.size!==ids.length)throw Error('Selección duplicada.');
 return ids.map(id=>{const t=items.find(t=>t.id===id);if(!t||t.household_id!==household||t.account_id||!t.updated_at||t.type==='TRANSFERENCIA_INTERNA')throw Error('Actualiza los movimientos antes de asignar.');if(closed.has(t.transaction_date.slice(0,7)))throw Error('Reabre primero el mes cerrado desde Cierre mensual.');return {resource:'transactions',household,id,create:false,expected:t.updated_at,payload:{household_id:household,account_id:account.id},label:t.concept,done:false}});
}
const api={cents,month,shift,periods,report,accountOperations};if(typeof module==='object'&&module.exports)module.exports=api;else root.UsualSpending=api;
})(typeof globalThis!=='undefined'?globalThis:this);
