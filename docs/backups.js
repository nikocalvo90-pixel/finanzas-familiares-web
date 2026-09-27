(function(root){
'use strict';
const LIMIT=100*1024*1024;
const TABLES=['accounts','account_balance_snapshots','categories','transactions','investments','investment_valuations','assets','asset_valuations','liabilities','liability_snapshots','liability_balance_snapshots','normalization_schedules','normalized_allocations','monthly_closures','net_worth_snapshots','reconciliations','savings_goals','recurring_rules','category_rules','family_tasks','budgets','payees','tags','transaction_documents'];
const encode=s=>new TextEncoder().encode(s);
async function hash(bytes,cryptoImpl){return Array.from(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')}
async function build({read,download,zip,cryptoImpl,build,progress=()=>{}}){
 progress('Leyendo todos los datos del hogar…');const data=await read(),json=JSON.stringify(data),files={'datos.json':encode(json)},documents=data.transaction_documents||[];
 let size=files['datos.json'].length;
 const ready=documents.filter(d=>d.status==='READY');
 if(size+ready.reduce((n,d)=>n+Number(d.size_bytes),0)>LIMIT)throw Error('La copia supera 100 MB. No se ha generado un archivo parcial.');
 for(let i=0;i<ready.length;i++){
   const d=ready[i];if(!/^[a-f0-9-]+\.(pdf|jpg|png|webp|heic|heif)$/.test(d.id+'.'+d.extension))throw Error('Documento con identificador no válido.');
   progress('Copiando documento '+(i+1)+' de '+ready.length+'…');const bytes=await download(d);
   size+=bytes.length;if(size>LIMIT)throw Error('La copia supera 100 MB.');
   if(bytes.length!==Number(d.size_bytes)||await hash(bytes,cryptoImpl)!==d.sha256)throw Error('No se pudo verificar el documento '+d.filename+'.');
   files['documentos/'+d.id+'.'+d.extension]=bytes;
 }
 progress('Comprobando que los datos no hayan cambiado…');
 if(JSON.stringify(await read())!==json)throw Error('Los datos cambiaron durante la copia. Vuelve a generarla sin editar el hogar mientras tanto.');
 const manifest={format:'finanzas-familiares-backup',version:1,app_build:build,created_at:new Date().toISOString(),household_id:data.households[0].id,counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),documents:ready.length,pending_documents:documents.filter(d=>d.status!=='READY').length,excluded:['Autenticación, contraseñas y sesiones','Invitaciones y claves de notificaciones','Preferencias y eventos de notificaciones','Registro de auditoría','Archivos de subidas pendientes'],files:{}};
 for(const [name,bytes] of Object.entries(files))manifest.files[name]={size:bytes.length,sha256:await hash(bytes,cryptoImpl)};
 files['manifest.json']=encode(JSON.stringify(manifest,null,2));
 const bytes=zip(files);if(bytes.length>LIMIT)throw Error('El ZIP supera 100 MB.');
 await verify(bytes,cryptoImpl);return {bytes,manifest};
}
async function verify(bytes,cryptoImpl,unpack=false){
 if(bytes.length>LIMIT)throw Error('Archivo mayor de 100 MB.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files={},entries={};let p=0;
 while(p+4<=bytes.length&&view.getUint32(p,true)===0x04034b50){
   if(p+30>bytes.length)throw Error('ZIP incompleto.');
   const flags=view.getUint16(p+6,true),method=view.getUint16(p+8,true),size=view.getUint32(p+18,true),raw=view.getUint32(p+22,true),nl=view.getUint16(p+26,true),el=view.getUint16(p+28,true),start=p+30+nl+el,end=start+size;
   if(method!==0||(flags&9)||raw!==size||end>bytes.length)throw Error('Formato ZIP no compatible o incompleto. Usa el ZIP original de la app.');
   const name=new TextDecoder().decode(bytes.slice(p+30,p+30+nl));
   if(!/^(datos\.json|manifest\.json|documentos\/[a-f0-9-]+\.(pdf|jpg|png|webp|heic|heif))$/.test(name)||Object.hasOwn(files,name))throw Error('Contenido inesperado o repetido.');
   files[name]=bytes.slice(start,end);entries[name]={offset:p,size,crc:view.getUint32(p+14,true)};p=end;
 }
 if(p+4>bytes.length||view.getUint32(p,true)!==0x02014b50||bytes.length<22||view.getUint32(bytes.length-22,true)!==0x06054b50)throw Error('ZIP incompleto.');
 const centralStart=p,seen=new Set();
 while(p+46<=bytes.length&&view.getUint32(p,true)===0x02014b50){
   const nl=view.getUint16(p+28,true),el=view.getUint16(p+30,true),cl=view.getUint16(p+32,true),end=p+46+nl+el+cl;
   if(end>bytes.length)throw Error('Directorio ZIP incompleto.');
   const name=new TextDecoder().decode(bytes.slice(p+46,p+46+nl)),entry=entries[name];
   if(!entry||seen.has(name)||view.getUint32(p+42,true)!==entry.offset||view.getUint32(p+20,true)!==entry.size||view.getUint32(p+24,true)!==entry.size||view.getUint32(p+16,true)!==entry.crc||view.getUint16(p+10,true)!==0)throw Error('Directorio ZIP dañado.');
   let crc=0xffffffff;for(const b of files[name]){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
   if(((crc^0xffffffff)>>>0)!==entry.crc)throw Error('Contenido ZIP dañado.');
   seen.add(name);p=end;
 }
 if(p!==bytes.length-22||seen.size!==Object.keys(files).length||view.getUint16(p+8,true)!==seen.size||view.getUint16(p+10,true)!==seen.size||view.getUint32(p+12,true)!==p-centralStart||view.getUint32(p+16,true)!==centralStart)throw Error('Directorio ZIP incompleto.');
 let manifest,data;try{manifest=JSON.parse(new TextDecoder().decode(files['manifest.json']));data=JSON.parse(new TextDecoder().decode(files['datos.json']))}catch{throw Error('No es una copia válida de Finanzas Familiares.')}
 if(manifest.format!=='finanzas-familiares-backup'||manifest.version!==1||!manifest.files||!Array.isArray(data.households)||data.households[0]?.id!==manifest.household_id)throw Error('Copia no compatible.');
 const names=Object.keys(manifest.files);
 if(names.length!==Object.keys(files).length-1||!names.includes('datos.json'))throw Error('Faltan archivos en la copia.');
 for(const name of names){const item=manifest.files[name],content=files[name];if(!content||content.length!==item.size||await hash(content,cryptoImpl)!==item.sha256)throw Error('Archivo dañado: '+name)}
 for(const [table,count] of Object.entries(manifest.counts||{}))if(!Array.isArray(data[table])||data[table].length!==count)throw Error('Recuento incorrecto: '+table);
 for(const table of [...TABLES,'households','household_members','transaction_tags'])if(!Array.isArray(data[table]))throw Error('Falta la tabla '+table);
 for(const d of data.transaction_documents){if(d.status==='READY'){const item=manifest.files['documentos/'+d.id+'.'+d.extension];if(!item||item.sha256!==d.sha256||item.size!==Number(d.size_bytes))throw Error('Documento incompleto.')}}
 if(data.transaction_documents.filter(d=>d.status==='READY').length!==manifest.documents)throw Error('Recuento de documentos incorrecto.');
 return unpack?{manifest,data,files}:manifest;
}
const OPTIONAL_TABLES=['shopping_items'];
const api={TABLES,OPTIONAL_TABLES,LIMIT,build,verify,hash};if(typeof module==='object'&&module.exports)module.exports=api;else root.FinanceBackups=api;
})(typeof globalThis!=='undefined'?globalThis:this);
