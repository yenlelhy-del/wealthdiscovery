'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const http=require('node:http');
const {spawn}=require('node:child_process');
test('email onboarding and protected dashboard',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fp-email-test-'));
 fs.chmodSync(dir,0o700);
 const emails=[];
 const mail=http.createServer(async(req,res)=>{let v='';for await(const x of req)v+=x;emails.push(JSON.parse(v));res.writeHead(200);res.end('{}')});
 await new Promise(resolve=>mail.listen(0,'127.0.0.1',resolve));
 const port=37500+Math.floor(Math.random()*999);
 const base='http://127.0.0.1:'+port+'/wealth-discovery/admin/api';
 const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),stdio:'ignore',env:{...process.env,PORT:String(port),DATA_DIR:dir,ADMIN_SESSION_SECRET:crypto.randomBytes(48).toString('hex'),RESEND_API_KEY:'test',MAIL_FROM:'no-reply@example.test',NODE_ENV:'test',TEST_MAIL_URL:'http://127.0.0.1:'+mail.address().port}});
 const post=(p,obj)=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});
 try{
  let ready=false;for(let i=0;i<60;i++){try{const r=await fetch(base.replace('/admin/api','')+'/health');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
  assert.equal(ready,true);
  assert.equal((await fetch(base+'/records')).status,401);
  assert.equal((await post('/request-link',{email:'another@example.test'})).status,200);
  assert.equal(emails.length,0);
  assert.equal((await post('/request-link',{email:'yenle.lhy@gmail.com'})).status,200);
  assert.equal(emails.length,1);
  let token=decodeURIComponent(emails[0].html.split('token=')[1].split('"')[0]);
  let password='FptestOnly'+crypto.randomBytes(12).toString('hex');
  assert.equal((await post('/reset-password',{token,password})).status,200);
  assert.equal((await post('/reset-password',{token,password})).status,400);
  assert.equal((await post('/login',{email:'other@example.test',password})).status,401);
  const res=await post('/login',{email:'yenle.lhy@gmail.com',password});
  assert.equal(res.status,200);
  const cookie=res.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base+'/records',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await post('/request-link',{email:'yenle.lhy@gmail.com'})).status,200);
  token=decodeURIComponent(emails[1].html.split('token=')[1].split('"')[0]);
  password='FptestOnly'+crypto.randomBytes(12).toString('hex');
  assert.equal((await post('/reset-password',{token,password})).status,200);
  assert.equal((await fetch(base+'/records',{headers:{Cookie:cookie}})).status,401);
  console.log('PASS email setup/reset, one-use token, rejected unauthorized access, session revocation');
 }finally{child.kill();await new Promise(r=>mail.close(r));fs.rmSync(dir,{recursive:true,force:true})}
});
