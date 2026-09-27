(function(root){
 const MAX_SIZE=10*1024*1024;
 function detect(bytes){
   const a=new Uint8Array(bytes),text=(from,to)=>String.fromCharCode(...a.slice(from,to));
   if(text(0,5)==='%PDF-')return {mime:'application/pdf',extension:'pdf'};
   if(a[0]===255&&a[1]===216&&a[2]===255)return {mime:'image/jpeg',extension:'jpg'};
   if([137,80,78,71,13,10,26,10].every((v,i)=>a[i]===v))return {mime:'image/png',extension:'png'};
   if(text(0,4)==='RIFF'&&text(8,12)==='WEBP')return {mime:'image/webp',extension:'webp'};
   if(text(4,8)==='ftyp'){
     const brand=text(8,12);
     if(['heic','heix','hevc','hevx'].includes(brand))return {mime:'image/heic',extension:'heic'};
     if(['mif1','msf1'].includes(brand))return {mime:'image/heif',extension:'heif'};
   }
   return null;
 }
 async function describe(file,cryptoImpl){
   if(!file.size)throw new Error('El archivo está vacío.');
   if(file.size>MAX_SIZE)throw new Error('El archivo supera 10 MB. Elige una foto o PDF más pequeño.');
   const bytes=await file.arrayBuffer(),kind=detect(bytes);
   if(!kind)throw new Error('Formato no compatible. Usa PDF, JPG, PNG, WebP, HEIC o HEIF.');
   const extension=String(file.name||'').split('.').pop().toLowerCase();
   const aliases=kind.extension==='jpg'?['jpg','jpeg']:['heic','heif'].includes(kind.extension)?['heic','heif']:[kind.extension];
   if(!aliases.includes(extension))throw new Error('La extensión del archivo no coincide con su contenido. Guarda una copia con el formato correcto.');
   const filename=String(file.name).replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(-180);
   const sha256=Array.from(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   return {filename,mime_type:kind.mime,extension:kind.extension,size_bytes:file.size,sha256};
 }
 async function upload(file,context,api,cryptoImpl){
   const info=await describe(file,cryptoImpl);
   let record=await api.find(info.sha256);
   if(!record){
     try{record=await api.create({...info,household_id:context.householdId,transaction_id:context.transactionId})}
     catch(error){record=await api.find(info.sha256);if(!record)throw error}
   }
   if(record.archived)return {record,existing:true,archived:true};
   if(record.status==='READY')return {record,existing:true};
   // If the upload response was lost, finalization can still verify the stored object.
   let uploadError;
   try{await api.upload(record,file)}catch(error){uploadError=error}
   try{return {record:await api.finalize(record),existing:false}}
   catch(error){throw new Error((uploadError?.message||error.message)+' La subida queda pendiente; selecciona de nuevo el mismo archivo para reintentar sin duplicarlo.')}
 }
 function signedUrl(base,path,filename,download){
   if(typeof path!=='string'||!path.startsWith('/object/sign/finanzas-documents/'))throw new Error('No se pudo generar el enlace privado.');
   const url=new URL(base+'/storage/v1'+path);
   if(url.origin!==new URL(base).origin||!url.pathname.startsWith('/storage/v1/object/sign/finanzas-documents/'))throw new Error('Enlace de documento no válido.');
   if(download)url.searchParams.set('download',filename);
   return url.toString();
 }
 const api={MAX_SIZE,detect,describe,upload,signedUrl};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FinanceDocuments=api;
})(typeof self!=='undefined'?self:this);
