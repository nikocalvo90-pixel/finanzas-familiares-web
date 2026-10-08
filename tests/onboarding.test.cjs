const {test}=require('node:test'),assert=require('node:assert/strict'),{payload}=require('../docs/onboarding.js');
const form={householdName:' Nuestra familia ',displayName:' Ana ',accountName:'Banco',balance:'1250,50',balanceDate:'2026-10-06'};
test('setup handles Spanish decimals, zero and negative balances without inventing income',()=>{
 assert.deepEqual(payload(form,'2026-10-06'),{p_name:'Nuestra familia',p_display_name:'Ana',p_account_name:'Banco',p_balance:1250.5,p_balance_date:'2026-10-06'});
 assert.equal(payload({...form,balance:'0'},'2026-10-06').p_balance,0);
 assert.equal(payload({...form,balance:'-15.25'},'2026-10-06').p_balance,-15.25);
});
test('skipping the account omits all financial inputs',()=>{
 assert.deepEqual(payload({...form,skipAccount:true,balance:'invalid'},'2026-10-06'),{p_name:'Nuestra familia',p_display_name:'Ana',p_account_name:null,p_balance:null,p_balance_date:null});
});
test('ambiguous and malformed amounts, blank names and invalid/future dates are rejected',()=>{
 for(const balance of ['','1.250,50','1,250.50','NaN','Infinity','1e3','0.001','1234567890123'])assert.throws(()=>payload({...form,balance},'2026-10-06'));
 for(const balanceDate of ['2026-02-30','2026-10-07','1899-12-31','bad'])assert.throws(()=>payload({...form,balanceDate},'2026-10-06'));
 assert.throws(()=>payload({...form,householdName:'  '},'2026-10-06'));
 assert.throws(()=>payload({...form,displayName:'a'.repeat(121)},'2026-10-06'));
});
test('first steps use actual records and ignore archived accounts',()=>{
 const {progress}=require('../docs/onboarding.js');
 assert.deepEqual(progress(),{account:false,movement:false,shared:false});
 assert.deepEqual(progress({accounts:[{is_archived:true}],transactions:[],members:[{}]}),{account:false,movement:false,shared:false});
 assert.deepEqual(progress({accounts:[{is_archived:false}],transactions:[{}],members:[{},{}]}),{account:true,movement:true,shared:true});
});
