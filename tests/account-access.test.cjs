const {test}=require('node:test'),assert=require('node:assert/strict'),A=require('../docs/account-access.js');
test('password confirmation preserves spaces and enforces byte limit',()=>{
 assert.equal(A.password('  example12  ','  example12  '),'  example12  ');
 for(const args of [['short','short'],['example12','different'],['🔐'.repeat(19),'🔐'.repeat(19)]])assert.throws(()=>A.password(...args));
 assert.equal(A.password('a'.repeat(72),'a'.repeat(72)).length,72);
});
test('email validation and delivery errors do not reveal account existence',()=>{
 assert.equal(A.email(' ana@example.com '),'ana@example.com');
 for(const e of ['','ana','ana@','a b@example.com'])assert.throws(()=>A.email(e));
 assert.match(A.emailError({status:429}),/Espera/);
 assert.match(A.emailError({message:'Email address not authorized'}),/servicio de correo/);
 assert.equal(A.emailError({message:'User missing'}),A.emailError({message:'User already exists'}));
});
