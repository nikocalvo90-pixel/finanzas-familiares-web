(function(root){
'use strict';
function bounds(month){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1900)throw Error('Selecciona un mes válido.');
 const y=Number(month.slice(0,4)),m=Number(month.slice(5)),days=new Date(Date.UTC(y,m,0)).getUTCDate();return {from:month+'-01',to:month+'-'+days,days};
}
function periods(month,today){
 const current=bounds(month),y=Number(month.slice(0,4)),m=Number(month.slice(5)),d=new Date(Date.UTC(y,m-2,1)),previousMonth=d.toISOString().slice(0,7),previous=bounds(previousMonth);
 if(month===today.slice(0,7)){const day=Number(today.slice(8,10));current.to=today;previous.to=previousMonth+'-'+String(Math.min(day,previous.days)).padStart(2,'0')}
 return {current,previous,previousMonth,partial:month===today.slice(0,7)};
}
function cents(value){const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>10000000)throw Error('Hay un importe fuera de rango.');return Math.round(n*100)}
function limit(raw){
 let s=String(raw??'').trim().replace(/[€\s]/g,'');
 if(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(s))s=s.replace(/\./g,'');
 s=s.replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw Error('Escribe un límite de cero o más, con hasta dos decimales.');
 const n=cents(s);if(n<0)throw Error('El límite no puede ser negativo.');return n/100;
}
function report(budgets,transactions,categories,month,today){
 const range=periods(month,today),current=new Map(),previous=new Map(),seen=new Set();
 for(const t of transactions){if(!['GASTO','DEVOLUCION'].includes(t.type)||t.id&&seen.has(t.id))continue;if(t.id)seen.add(t.id);const date=String(t.transaction_date||''),id=t.category_id||'',amount=cents(t.amount)*(t.type==='GASTO'?1:-1);
  const map=date>=range.current.from&&date<=range.current.to?current:date>=range.previous.from&&date<=range.previous.to?previous:null;if(map)map.set(id,(map.get(id)||0)+amount);
 }
 const byCategory=new Map();for(const b of budgets){if(b.month!==month+'-01'||!b.category_id)continue;if(byCategory.has(b.category_id))throw Error('Hay límites duplicados para una categoría.');byCategory.set(b.category_id,b)}
 const ids=new Set([...byCategory.keys(),...current.keys(),...previous.keys()]);
 const rows=[...ids].map(id=>{
  const budget=byCategory.get(id),spent=current.get(id)||0,before=previous.get(id)||0,cap=budget?cents(budget.amount):null;
  if(cap!==null&&cap<0)throw Error('Hay un límite negativo.');
  const ratio=cap===null?null:cap===0?(spent>0?Infinity:0):Math.max(0,spent/cap);
  const status=cap===null?'none':spent>cap?'over':spent===cap&&cap>0?'reached':ratio>=.8?'near':'ok';
  return {id,name:categories.find(c=>c.id===id)?.name||(id?'Categoría archivada':'Sin categoría'),budget,cap,spent,previous:before,remaining:cap===null?null:cap-spent,ratio,status,delta:spent-before,percent:before===0?null:(spent-before)/Math.abs(before)*100};
 }).sort((a,b)=>Number(!!b.budget)-Number(!!a.budget)||a.name.localeCompare(b.name,'es'));
 const limited=rows.filter(r=>r.budget),unlimited=rows.filter(r=>!r.budget),sum=(xs,k)=>xs.reduce((s,r)=>s+(r[k]||0),0);
 return {rows,limited,unlimited,range,cap:sum(limited,'cap'),spent:sum(limited,'spent'),remaining:sum(limited,'remaining'),withoutLimit:sum(unlimited,'spent'),alerts:limited.filter(r=>['near','reached','over'].includes(r.status))};
}
const api={bounds,periods,cents,limit,report};if(typeof module==='object'&&module.exports)module.exports=api;else root.FamilyBudgets=api;
})(typeof globalThis!=='undefined'?globalThis:this);
