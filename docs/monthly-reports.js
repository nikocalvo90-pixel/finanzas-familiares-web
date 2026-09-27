(function(root){
'use strict';
const types={income:['INGRESO'],expenses:['GASTO'],refunds:['DEVOLUCION'],savings:['INGRESO','DEVOLUCION','GASTO']};
function bounds(month){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1900)throw Error('Selecciona un mes válido.');
 const y=Number(month.slice(0,4)),m=Number(month.slice(5));
 return {from:month+'-01',to:month+'-'+new Date(Date.UTC(y,m,0)).getUTCDate()};
}
function cents(t){const n=Number(t.amount);if(!Number.isFinite(n))throw Error('Hay un importe no válido.');return Math.round(n*100)}
function select(rows,month,metric,category){
 bounds(month);return rows.filter(t=>t.transaction_date.slice(0,7)===month&&(types[metric]||types.savings).includes(t.type)&&(category===undefined||(t.category_id||'')===category));
}
function total(rows,metric){return rows.reduce((sum,t)=>sum+cents(t)*((metric==='savings'||metric==='netExpense')?(t.type==='GASTO'?(metric==='savings'?-1:1):t.type==='DEVOLUCION'?(metric==='savings'?1:-1):1):1),0)}
function change(current,previous){return {delta:current-previous,percent:previous===0?null:(current-previous)/Math.abs(previous)*100}}
function report(rows,current,previous,categories){
 bounds(current);bounds(previous);const metrics={};
 for(const key of Object.keys(types)){const a=total(select(rows,current,key),key),b=total(select(rows,previous,key),key);metrics[key]={current:a,previous:b,...change(a,b)}}
 const expenseRows=rows.filter(t=>[current,previous].includes(t.transaction_date.slice(0,7))&&['GASTO','DEVOLUCION'].includes(t.type));
 const ids=[...new Set(expenseRows.map(t=>t.category_id||''))];
 const breakdown=ids.map(id=>{const amount=month=>total(expenseRows.filter(t=>t.transaction_date.slice(0,7)===month&&(t.category_id||'')===id),'netExpense');const a=amount(current),b=amount(previous);return {id,name:categories.find(c=>c.id===id)?.name||'Sin categoría',current:a,previous:b,...change(a,b)}}).sort((a,b)=>b.current-a.current||a.name.localeCompare(b.name));
 return {metrics,breakdown};
}
const api={bounds,select,total,change,report};if(typeof module==='object'&&module.exports)module.exports=api;else root.MonthlyReports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
