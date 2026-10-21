'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'../docs/index.html'),'utf8');
const meta=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
test('CSP authorizes exact application code and refuses injected inline scripts and handlers',()=>{
 assert(meta,'Run node scripts/update-security-policy.cjs');
 const directives=new Map(meta[1].split(';').map(s=>{const [name,...values]=s.trim().split(/\s+/);return[name,values]}));
 const scripts=directives.get('script-src');assert(scripts.includes("'self'"));assert(!scripts.includes("'unsafe-inline'"));assert(!scripts.includes("'unsafe-eval'"));assert(!scripts.includes('*'));
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(/\bsrc\s*=/.test(match[1]))continue;
  assert(scripts.includes("'sha256-"+createHash('sha256').update(match[2]).digest('base64')+"'"),'Inline code changed: update its hash');
 }
 assert(!scripts.includes("'sha256-"+createHash('sha256').update('alert(document.cookie)').digest('base64')+"'"));
 assert.deepEqual(directives.get('script-src-attr'),["'none'"]);
 assert.deepEqual(directives.get('object-src'),["'none'"]);
 assert.deepEqual(directives.get('base-uri'),["'none'"]);
 assert.deepEqual(directives.get('connect-src'),["'self'",'https://lqsoxkoiwczouhvefmgg.supabase.co']);
 assert(html.indexOf(meta[0])<html.indexOf('<script'));
 assert.match(html,/<meta name="referrer" content="no-referrer">/);
});
test('all loaded script assets stay on this origin and parse without runtime code generation',()=>{
 for(const match of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)){
  assert(match[1].startsWith('./'));assert(!match[1].includes('..'));
  new vm.Script(fs.readFileSync(path.join(__dirname,'../docs',match[1].split('?')[0]),'utf8'));
 }
 const source=fs.readFileSync(path.join(__dirname,'../docs/vendor/xlsx-0.20.3.full.min.js'),'utf8');
 const context=vm.createContext({},{codeGeneration:{strings:false,wasm:false}});vm.runInContext(source,context);
 assert.equal(typeof context.XLSX.read,'function');
});
