(function(root){
'use strict';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const plurals={yogures:'yogur',yogurt:'yogur',yogurts:'yogur',huevos:'huevo',kiwis:'kiwi',platanos:'platano',limones:'limon',naranjas:'naranja',tomates:'tomate',cebollas:'cebolla',pimientos:'pimiento',aguacates:'aguacate',patatas:'patata',manzanas:'manzana',nueces:'nuez',almendras:'almendra',pistachos:'pistacho',anacardos:'anacardo',garbanzos:'garbanzo'};
const productKey=s=>normalize(s).split(' ').map(w=>plurals[w]||w).join(' ');
const numbers={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veintiuno:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,medio:'0,5',media:'0,5'};
const amount='(?:\\d+(?:[.,]\\d+)?|'+Object.keys(numbers).join('|')+')';
const units='(?:botellas?|botes?|paquetes?|kilos?|kg|gramos?|g|litros?|l|mililitros?|ml|unidades?|uds?|bandejas?|bolsas?|tarros?|latas?|piezas?|docenas?|manojos?)';
const prefix=new RegExp('^('+amount+')(?:\\s+('+units+'))?\\s+(?:de\\s+)?(.+)$','i');
const suffix=new RegExp('^(.+?)\\s+\\(?('+amount+')\\s+('+units+')\\)?$','i');
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function parse(raw,items=[]){
 if(String(raw).length>6000)throw Error('La lista es demasiado larga. Divide el texto en varias listas.');
 let text=String(raw||'').trim().replace(/^lista\s+(?:de\s+(?:la\s+)?)?compra\s*:?\s*/i,'');
 text=text.split('\n').filter(s=>!/^\s*(?:frutas?|verduras?|l[aá]cteos|despensa|bebidas|limpieza|bebé|otros)\s*:\s*$/i.test(s)).map(s=>s.replace(/^\s*\d+\.\s+/,'' )).join('\n');
 // Preserve decimal commas/dots and conjunctions inside known product names.
 text=text.replace(/(\d)[,.](?=\d)/g,'$1\uE000');
 for(const item of [...items,{name:'fruta y verdura'}])if(/\s[ye]\s/i.test(item.name||''))text=text.replace(new RegExp(escape(item.name),'gi'),m=>m.replace(/\s([ye])\s/gi,' \uE001 '));
 const pieces=text.split(/[,;\n.!]+|\s+(?:y|e)\s+/i).map(s=>s.replace(/\uE000/g,',').replace(/\uE001/g,'y').trim()).filter(Boolean);
 const rows=[],seen=new Map();
 for(let part of pieces){
  part=part.replace(/^\s*(?:[-*•]+\s*(?:\[[ xX]\]\s*)?|\d+\.\s+)/,'').replace(/^(?:(?:necesito|necesitamos|quiero|queremos|añade|añadir|comprar|compra|también|y)[\s:]+)+/i,'').replace(/:$/,'').trim();
  if(!part)continue;
  let name=part,quantity='';const m=part.match(prefix)||part.match(suffix);
  if(m){const isPrefix=!!part.match(prefix),n=isPrefix?m[1]:m[2],unit=isPrefix?m[2]:m[3];name=isPrefix?m[3]:m[1];quantity=String(numbers[normalize(n)]??n)+(unit?' '+unit:'')}
  name=name.trim().replace(/\s*[-—–:]\s*$/,'').replace(/\s+/g,' ');if(!name||name.length>120||quantity.length>80)throw Error('Revisa el producto «'+part+'»: el nombre o la cantidad son demasiado largos.');
  const key=normalize(name),previous=seen.get(key);
  if(previous){if(quantity&&previous.quantity&&quantity!==previous.quantity){previous.warning='Cantidades distintas: '+previous.quantity+' / '+quantity+'. Revísalas.';previous.quantity=''}else if(!previous.quantity&&!previous.warning)previous.quantity=quantity;continue}
  const row={name,quantity,selected:true,warning:''};rows.push(row);seen.set(key,row);
 }
 if(!rows.length)throw Error('Escribe o dicta al menos un producto.');
 if(rows.length>60)throw Error('Puedes revisar hasta 60 productos de una vez.');return rows;
}
function candidates(name,items){
 const key=productKey(name),exact=items.filter(i=>productKey(i.name)===key);
 if(exact.length)return {exact:true,items:exact};
 const words=key.split(' ').filter(x=>x.length>2);
 return {exact:false,items:items.filter(i=>{const other=productKey(i.name).split(' ');return words.length&&words.every(w=>other.includes(w))}).slice(0,8)};
}
function review(raw,items){return parse(raw,items).map(row=>{const c=candidates(row.name,items);return {...row,match:c.exact&&c.items.length===1?c.items[0].id:c.items.length?'':'new'}})}
function prepare(rows,items,household,favorite,uuid){
 const selected=rows.filter(r=>r.selected),seen=new Set();if(!selected.length)throw Error('Selecciona al menos un producto.');
 return selected.map(row=>{
  const name=String(row.name||'').trim().replace(/\s+/g,' '),quantity=String(row.quantity||'').trim();
  if(!name||name.length>120||quantity.length>80)throw Error('Revisa el nombre y cantidad de cada producto.');
  if(row.warning&&!quantity)throw Error('Revisa la cantidad repetida de «'+name+'» antes de añadirlo.');
  const old=row.match!=='new'&&items.find(i=>i.id===row.match);if(row.match!=='new'&&!old)throw Error('Elige un producto guardado o «Crear producto nuevo» para '+name+'.');
  if(!old&&candidates(name,items).exact)throw Error('«'+name+'» ya está guardado. Elígelo para evitar duplicados.');
  const key=old?'id:'+old.id:'name:'+normalize(name);if(seen.has(key))throw Error('Hay dos filas para «'+name+'». Desmarca una o revisa los nombres.');seen.add(key);
  const id=old?.id||uuid(),payload=old?{household_id:household,purchased:false,archived:false}:{id,household_id:household,name,quantity,note:'',section:'Otros',favorite:!!favorite};
  if(old){if(quantity)payload.quantity=quantity;if(favorite)payload.favorite=true}
  return {resource:'shopping_items',id,household,create:!old,expected:old?.updated_at||null,payload,label:old?.name||name,done:false};
 });
}
function validOperations(ops,household){return Array.isArray(ops)&&ops.length>0&&ops.length<=60&&ops.every(o=>o.resource==='shopping_items'&&o.id&&o.household===household&&o.payload?.household_id===household&&typeof o.create==='boolean')}
async function execute(operations,api){
 for(const op of operations){api.assert();if(op.done)continue;
  const result=await api.save(op);api.assert();if(!result?.record||result.record.id!==op.id||result.record.household_id!==op.household)throw Error('No se pudo confirmar este producto.');
  op.done=true;api.persist();api.apply(result.record);api.progress();
 }
 api.assert();return operations.length;
}
const api={normalize,parse,candidates,review,prepare,validOperations,execute};if(typeof module==='object'&&module.exports)module.exports=api;else root.ShoppingBatch=api;
})(typeof globalThis!=='undefined'?globalThis:this);
