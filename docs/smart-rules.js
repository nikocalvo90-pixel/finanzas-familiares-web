/* Shared pure matching logic. Rules suggest categories; they never save movements. */
(function(root){
 const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 function matches(text,rule){
   const value=normalize(text),pattern=normalize(rule.pattern);
   if(!pattern)return false;
   return rule.match_mode==='EXACT'?value===pattern:
     rule.match_mode==='WORDS'&&(' '+value+' ').includes(' '+pattern+' ');
 }
 function suggest(text,type,rules,categories){
   const valid=(rules||[]).filter(r=>r.active&&(!type||r.transaction_type===type)&&
     categories.some(c=>c.id===r.category_id&&!c.is_archived&&c.kind===r.transaction_type)&&matches(text,r));
   if(!valid.length)return null;
   const rank=r=>(r.match_mode==='EXACT'?10000:0)+normalize(r.pattern).length;
   const best=Math.max(...valid.map(rank)),top=valid.filter(r=>rank(r)===best);
   if(new Set(top.map(r=>r.transaction_type+'|'+r.category_id)).size>1)
     return {conflict:true,confidence:0,reason:'Hay reglas coincidentes con categorías distintas. Revisa este movimiento.'};
   const rule=top[0];
   return {category_id:rule.category_id,type:rule.transaction_type,rule_id:rule.id,confidence:rule.match_mode==='EXACT'?.99:.96,
     reason:'Regla '+(rule.origin==='LEARNED'?'aprendida':'del hogar')+': «'+rule.pattern+'».'};
 }
 function shouldLearn(original,category,type,checked){
   return !!(checked&&category&&(category!==(original?.category_id||'')||type!==original?.type));
 }
 function conflicts(rows){
   const seen=new Map();
   for(const row of rows){
     if(!row.learn_category||!row.category_id)continue;
     const key=row.type+'|'+normalize(row.concept),prior=seen.get(key);
     if(prior&&prior!==row.category_id)return true;
     seen.set(key,row.category_id);
   }
   return false;
 }
 const api={normalize,matches,suggest,shouldLearn,conflicts};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FinanceRules=api;
})(typeof self!=='undefined'?self:this);
