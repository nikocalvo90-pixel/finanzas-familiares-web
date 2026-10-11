(function(root){
'use strict';
const key=(user,household,kind)=>'ff_form_draft_v1:'+user+':'+household+':'+kind;
function read(storage,user,household,kind,now=Date.now()){
 try{const x=JSON.parse(storage.getItem(key(user,household,kind)));if(x?.version!==1||x.user!==user||x.household!==household||x.kind!==kind||!x.form||(!x.pending&&!x.form.operations?.length&&now-x.updated>30*86400000))return null;
 if(x.pending&&(x.pending.household!==household||x.pending.payload?.household_id!==household))return null;return x}catch{return null}
}
function write(storage,user,household,kind,value,now=Date.now()){
 const text=JSON.stringify({...value,version:1,user,household,kind,updated:now}),k=key(user,household,kind);storage.setItem(k,text);if(storage.getItem(k)!==text)throw Error('No se pudo conservar el borrador.');
}
function clear(storage,user,household,kind){storage.removeItem(key(user,household,kind))}
function conflict(message){const e=Error(message);e.status=409;e.conflict=true;return e}
function matches(record,payload){return Object.entries(payload).every(([k,v])=>record[k]===v)}
function definite(e){return !e.sessionCancelled&&([400,403,404,409,422].includes(e.status)||e.conflict)}
function message(e){
 if(e.conflict)return e.message;
 if(e.code==='23505')return 'Este elemento ya existe en el hogar. Actualiza los datos para revisarlo; no se ha añadido otra copia.';
 if(e.network||e.offline)return 'Sin conexión con Casuo. El borrador se conserva en este dispositivo. Cuando vuelva internet, pulsa Reintentar.';
 if(definite(e))return 'No se ha guardado. Revisa los datos: '+e.message;
 return 'No se pudo confirmar el guardado. El borrador se conserva; pulsa Comprobar y reintentar para evitar duplicados.';
}
async function save(operation,api){
 const check=()=>api.assert?.();check();
 const valid=r=>r&&r.id===operation.id&&r.household_id===operation.household;
 const find=async()=>{check();const r=await api.find(operation.id);check();if(r&&!valid(r))throw Error('El servidor devolvió un registro de otro hogar.');return r};
 const current=await find();
 if(operation.create&&current)return {record:current,existing:true};
 if(!operation.create){
  if(!current)throw conflict('Este elemento ya no está disponible. Actualiza los datos antes de editarlo.');
  if(matches(current,operation.payload))return {record:current,existing:true};
  if(!operation.expected||current.updated_at!==operation.expected)throw conflict('Otra persona ha cambiado este elemento. Tu borrador se conserva. Cierra el formulario, actualiza los datos y descarta el borrador para editar la versión actual.');
 }
 try{
  check();const rows=await api.write(operation);check();const record=rows?.[0];
  if(!valid(record))throw Error('El servidor no confirmó el guardado.');
  return {record,existing:false};
 }catch(e){
  check();try{const confirmed=await find();if(confirmed&&(operation.create||matches(confirmed,operation.payload)))return {record:confirmed,existing:true}}catch(err){if(err.sessionCancelled)throw err}
  check();throw e;
 }
}
function actions(storage,user,household){const ops=read(storage,user,household,'actions')?.form.operations;return (Array.isArray(ops)?ops:[]).filter(x=>['shopping_items','family_tasks'].includes(x.resource)&&x.household===household&&x.payload?.household_id===household)}
function setActions(storage,user,household,operations){if(operations.length)write(storage,user,household,'actions',{form:{operations}});else clear(storage,user,household,'actions')}
const api={actions,setActions,key,read,write,clear,conflict,matches,definite,message,save};if(typeof module==='object'&&module.exports)module.exports=api;else root.SaveRecovery=api;
})(typeof globalThis!=='undefined'?globalThis:this);
