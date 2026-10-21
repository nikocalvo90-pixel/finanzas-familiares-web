/* Run after changing inline application code. The exact script bytes are authorized. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const filename=path.join(__dirname,'../docs/index.html');
let html=fs.readFileSync(filename,'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>! /\bsrc\s*=/.test(m[1]));
const hashes=scripts.map(m=>"'sha256-"+createHash('sha256').update(m[2]).digest('base64')+"'");
if(!hashes.length)throw Error('No application script found.');
const policy=[
 "default-src 'self'",
 "script-src 'self' "+hashes.join(' '),
 "script-src-attr 'none'",
 "style-src 'self' 'unsafe-inline'",
 "connect-src 'self' https://lqsoxkoiwczouhvefmgg.supabase.co",
 "img-src 'self' data: blob: https://lqsoxkoiwczouhvefmgg.supabase.co",
 "font-src 'self'",
 "worker-src 'self'",
 "object-src 'none'",
 "base-uri 'none'",
 "form-action 'self'",
 "frame-src 'none'"
].join('; ');
html=html.replace(/\n?<meta http-equiv="Content-Security-Policy"[^>]*>/i,'');
html=html.replace(/\n?<meta name="referrer"[^>]*>/i,'');
html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="'+policy+'">\n<meta name="referrer" content="no-referrer">');
fs.writeFileSync(filename,html);
console.log('Security policy updated for '+hashes.length+' exact inline script(s).');
