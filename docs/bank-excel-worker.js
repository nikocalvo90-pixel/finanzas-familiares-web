/* Excel parsing stays in a disposable worker on this device. No uploads or formula evaluation. */
function bankExcelSheets(bytes,X){
 let data=bytes,type='array';
 const head=new Uint8Array(bytes,0,Math.min(bytes.byteLength,512));
 // Some banks export HTML or SpreadsheetML with an .xls extension.
 if(head[0]===0xff&&head[1]===0xfe){data=new TextDecoder('utf-16le').decode(bytes);type='string'}
 else if(head[0]===0xfe&&head[1]===0xff){data=new TextDecoder('utf-16be').decode(bytes);type='string'}
 else if(/^\s*</.test(new TextDecoder().decode(head).replace(/^\uFEFF/,''))){
   try{data=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
   catch{data=new TextDecoder('windows-1252').decode(bytes)}
   type='string';
 }
 let workbook;
 try{workbook=X.read(data,{type,raw:true,dense:true,cellDates:false,cellFormula:false,
   cellHTML:false,cellText:false,bookVBA:false,sheetRows:2052})}
 catch(e){
   if(/password|encrypt/i.test(e.message))throw new Error('El Excel está protegido con contraseña. Guarda una copia sin contraseña para importarla.');
   throw new Error('No se pudo leer el Excel. Descarga de nuevo el extracto en XLS o XLSX.');
 }
 if(workbook.SheetNames.length>30)throw new Error('El Excel tiene demasiadas hojas. Guarda solo la hoja de movimientos.');
 const sheets=[];
 for(const name of workbook.SheetNames){
   const sheet=workbook.Sheets[name];if(!sheet?.['!ref'])continue;
   const range=X.utils.decode_range(sheet['!ref']);
   const full=X.utils.decode_range(sheet['!fullref']||sheet['!ref']);
   if(range.e.c>99||full.e.r>2050){
     sheets.push({name,error:'Esta hoja es demasiado grande. Exporta un periodo más corto (hasta 500 movimientos).'});continue;
   }
   const rows=[];
   for(let r=range.s.r;r<=range.e.r;r++){
     const cells=[];
     for(let c=range.s.c;c<=range.e.c;c++){
       const cell=sheet['!data']?.[r]?.[c]||sheet[X.utils.encode_cell({r,c})];
       let value=cell?.v??'';
       if(cell?.t==='e')value='#ERROR';
       if(cell?.t==='d')value=Number.isNaN(new Date(value).getTime())?'':new Date(value).toISOString().slice(0,10);
       cells.push(typeof value==='number'?value:String(value).trim());
     }
     if(cells.some(v=>v!==''))rows.push({cells,line:r+1});
   }
   sheets.push({name,rows,date1904:!!workbook.Workbook?.WBProps?.date1904});
 }
 if(!sheets.length)throw new Error('El Excel no contiene ninguna hoja con datos.');
 return sheets;
}
self.onmessage=event=>{
 try{
   importScripts('./vendor/xlsx-0.20.3.full.min.js');
   self.postMessage({sheets:bankExcelSheets(event.data,XLSX)});
 }catch(e){self.postMessage({error:e.message||'No se pudo leer el Excel. Vuelve a intentarlo.'})}
};
