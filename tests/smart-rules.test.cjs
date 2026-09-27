const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const rules=require('../docs/smart-rules.js');
const categories=[{id:'food',name:'Alimentación',kind:'GASTO'},{id:'rest',name:'Restaurantes',kind:'GASTO'},{id:'salary',name:'Nómina',kind:'INGRESO'},{id:'old',name:'Archivada',kind:'GASTO',is_archived:true}];
const rule=(overrides={})=>({id:'r1',pattern:'mercadona',match_mode:'WORDS',transaction_type:'GASTO',category_id:'food',active:true,origin:'MANUAL',...overrides});

test('word rules match complete normalized phrases, never substrings or regexes',()=>{
 assert.equal(rules.matches('PAGO TARJETA MERCADÓNA Madrid',rule()),true);
 assert.equal(rules.matches('gasolina',rule({pattern:'gas'})),false);
 assert.equal(rules.matches('cargo del gas',rule({pattern:'gas'})),true);
 assert.equal(rules.matches('amazon prime video',rule({pattern:'amazon prime'})),true);
 assert.equal(rules.matches('amazon compras prime',rule({pattern:'amazon prime'})),false);
 assert.equal(rules.matches('Mercadona Madrid',rule({match_mode:'EXACT'})),false);
 assert.equal(rules.normalize('  CAFÉ / España  '),'cafe espana');
});
test('paused, archived, missing and mismatched category rules cannot classify',()=>{
 for(const r of [rule({active:false}),rule({category_id:'old'}),rule({category_id:'missing'}),rule({category_id:'salary'})])
   assert.equal(rules.suggest('mercadona','GASTO',[r],categories),null);
 assert.equal(rules.suggest('mercadona','INGRESO',[rule()],categories),null);
});
test('exact corrections outrank general commerce rules; the most specific phrase wins',()=>{
 const general=rule(),specific=rule({id:'specific',pattern:'mercadona restaurante',category_id:'rest'});
 assert.equal(rules.suggest('pago mercadona restaurante madrid','GASTO',[general,specific],categories).category_id,'rest');
 const exact=rule({id:'exact',pattern:'pago mercadona restaurante madrid',match_mode:'EXACT',category_id:'food',origin:'LEARNED'});
 assert.equal(rules.suggest(exact.pattern,'GASTO',[specific,exact],categories).rule_id,'exact');
 assert.match(rules.suggest(exact.pattern,'GASTO',[exact],categories).reason,/aprendida/);
});
test('equally specific contradictory rules require review instead of choosing arbitrarily',()=>{
 const result=rules.suggest('pago shop cafe','GASTO',[rule({pattern:'shop'}),rule({pattern:'cafe',category_id:'rest'})],categories);
 assert.equal(result.conflict,true);assert.equal(result.confidence,0);assert.equal(result.category_id,undefined);
 const crossType=rules.suggest('mercadona',null,[rule(),rule({transaction_type:'INGRESO',category_id:'salary'})],categories);
 assert.equal(crossType.conflict,true);
});
test('learning requires a real confirmed category change and respects the Remember checkbox',()=>{
 const original={type:'GASTO',category_id:'food'};
 assert.equal(rules.shouldLearn(original,'rest','GASTO',true),true);
 assert.equal(rules.shouldLearn(original,'food','GASTO',true),false);
 assert.equal(rules.shouldLearn(original,'rest','GASTO',false),false);
 assert.equal(rules.shouldLearn(original,'','GASTO',true),false);
 assert.equal(rules.shouldLearn({type:'GASTO',category_id:''},'food','GASTO',true),true);
});
test('contradictory corrections in one bank batch are blocked only when both would be learned',()=>{
 const row={concept:'MERCADÓNA',type:'GASTO',category_id:'food',learn_category:true};
 assert.equal(rules.conflicts([row,{...row,concept:'mercadona',category_id:'rest'}]),true);
 assert.equal(rules.conflicts([row,{...row,category_id:'rest',learn_category:false}]),false);
 assert.equal(rules.conflicts([row,{...row,category_id:'salary',type:'INGRESO'}]),false);
});
test('manual entry applies the saved correction before the built-in category suggestion',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../docs/index.html'),'utf8');
 const ctx=vm.createContext({FinanceRules:rules,todayISO:()=> '2026-09-27',state:{data:{categories,transactions:[],smartRules:[rule({match_mode:'EXACT',category_id:'rest',origin:'LEARNED'})]}}});
 vm.runInContext(html.slice(html.indexOf('function norm('),html.indexOf('// Bank files')),ctx);
 const result=vm.runInContext('interpretNatural("51 Mercadona")',ctx);
 assert.equal(result.amount,51);assert.equal(result.category_id,'rest');assert.match(result.reason,/aprendida/);
});
