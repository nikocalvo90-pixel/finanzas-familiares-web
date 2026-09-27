(function(root){
'use strict';
const key=(user,household)=>'ff_entry_draft_v1:'+user+':'+household;
function read(storage,user,household,now=Date.now()){
 try{const x=JSON.parse(storage.getItem(key(user,household)));if(x?.version!==1||x.user!==user||x.household!==household||now-x.updated>30*86400000||typeof x.raw!=='string')return null;return x}catch{return null}
}
function write(storage,user,household,value,now=Date.now()){storage.setItem(key(user,household),JSON.stringify({...value,version:1,user,household,updated:now}))}
function clear(storage,user,household){storage.removeItem(key(user,household))}
async function saveOnce(payload,api){
 const old=await api.find(payload.external_id);if(old)return {existing:true,record:old};
 try{const rows=await api.insert(payload);if(!rows?.length)throw Error('El servidor no confirmó el guardado.');return {existing:false,record:rows[0]}}
 catch(e){try{const saved=await api.find(payload.external_id);if(saved)return {existing:true,record:saved}}catch{}throw e}
}
const api={key,read,write,clear,saveOnce};if(typeof module==='object'&&module.exports)module.exports=api;else root.EntryDrafts=api;
})(typeof globalThis!=='undefined'?globalThis:this);
