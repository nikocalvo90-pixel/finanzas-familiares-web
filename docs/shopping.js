(function(root){
'use strict';
const SECTIONS=['Fruta y verdura','Carne y pescado','Lácteos y huevos','Pan y cereales','Despensa','Congelados','Bebidas','Limpieza e higiene','Bebé','Otros'];
function payload(form){
 const name=String(form.name||'').trim().replace(/\s+/g,' '),quantity=String(form.quantity||'').trim(),note=String(form.note||'').trim();
 if(!name||name.length>120)throw Error('Escribe un producto de hasta 120 caracteres.');
 if(quantity.length>80||note.length>500)throw Error('Cantidad: máximo 80 caracteres. Nota: máximo 500.');
 if(!SECTIONS.includes(form.section))throw Error('Selecciona una sección.');
 return {name,quantity,note,section:form.section,favorite:!!form.favorite};
}
function groups(items){return SECTIONS.map(section=>({section,items:items.filter(x=>!x.archived&&!x.purchased&&x.section===section).sort((a,b)=>a.name.localeCompare(b.name,'es'))})).filter(g=>g.items.length)}
const api={SECTIONS,payload,groups};if(typeof module==='object'&&module.exports)module.exports=api;else root.FamilyShopping=api;
})(typeof globalThis!=='undefined'?globalThis:this);
