(function(root){
'use strict';
function summarize(metrics,rules,today){
 const month=today.slice(0,7),y=Number(month.slice(0,4)),m=Number(month.slice(5)),days=new Date(Date.UTC(y,m,0)).getUTCDate();
 const end=month+'-'+days,day=Number(today.slice(8)),income=Number(metrics.income||0),savings=Number(metrics.operating_savings||0);
 const pending=rules.filter(r=>r.active&&['GASTO','INVERSION'].includes(r.type)&&r.next_due_date&&r.next_due_date<=end&&(!r.end_date||r.next_due_date<=r.end_date)&&(!r.start_date||r.next_due_date>=r.start_date)).map(r=>({...r,overdue:r.next_due_date<today})).sort((a,b)=>a.next_due_date.localeCompare(b.next_due_date)||a.name.localeCompare(b.name));
 return {month,days,day,daysLeft:days-day,progress:Math.round(day/days*100),income,savings,savingsRate:income>0?savings/income*100:null,pending,overdue:pending.filter(r=>r.overdue).length};
}
const api={summarize};if(typeof module==='object'&&module.exports)module.exports=api;else root.ThisMonth=api;
})(typeof globalThis!=='undefined'?globalThis:this);
