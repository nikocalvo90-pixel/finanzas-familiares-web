(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FamilyOnboarding=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function name(value,label){const text=String(value||'').trim().replace(/\s+/g,' ');if(!text||text.length>120)throw Error(label+' debe tener entre 1 y 120 caracteres.');return text}
 function payload(form,today){
  const p={p_name:name(form.householdName,'El nombre del hogar'),p_display_name:name(form.displayName,'Tu nombre'),p_account_name:null,p_balance:null,p_balance_date:null};
  if(form.skipAccount)return p;
  p.p_account_name=name(form.accountName,'El nombre de la cuenta');
  const raw=String(form.balance??'').trim();
  if(!/^-?\d{1,12}(?:[.,]\d{1,2})?$/.test(raw))throw Error('Escribe el saldo sin separadores de miles, por ejemplo 1250,50.');
  p.p_balance=Number(raw.replace(',','.'));
  const date=String(form.balanceDate||''),parsed=new Date(date+'T12:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<'1900-01-01'||date>today||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw Error('Indica una fecha válida para el saldo, hasta hoy.');
  p.p_balance_date=date;return p;
 }
 return {payload};
});
