'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawn,execFileSync}=require('node:child_process');
test('setup link, email login, protected data, CSRF and password change',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'finpeace-admin-'));fs.chmodSync(dir,0o700);
 const id='FP-TEST123-ABCDEF1234';
 fs.writeFileSync(path.join(dir,id+'.json'),JSON.stringify({id,submittedAt:new Date().toISOString(),answers:{name:'TEST ONLY'}}));
 let child;
 try{
 const linkOutput=execFileSync(process.execPath,['scripts/create-admin-setup-link.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,DATA_DIR:dir},encoding:'utf8'});
 const setupToken=linkOutput.split('setup=')[1].split('\n')[0].trim();
 assert.ok(setupToken.length>30);
 const port=36000+Math.floor(Math.random()*1500),base='http://127.0.0.1:'+port+'/wealth-discovery/admin/api';
 child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DATA_DIR:dir,ADMIN_SESSION_SECRET:crypto.randomBytes(48).toString('hex'),NODE_ENV:'test'},stdio:'ignore'});
 let ready=false;for(let i=0;i<70;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/wealth-discovery/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.equal(ready,true);
 const post=(url,data,headers={})=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 assert.equal((await fetch(base+'/records')).status,401);
 const password='TestOnly_2026_Strong_Account_Password';
 assert.equal((await post('/setup',{token:setupToken,password})).status,200);
 assert.equal((await post('/setup',{token:setupToken,password})).status,400);
 assert.equal((await post('/login',{email:'notadmin@example.test',password})).status,401);
 let res=await post('/login',{email:'yenle.lhy@gmail.com',password});assert.equal(res.status,200);
 const session=await res.json(),cookie=res.headers.get('set-cookie').split(';')[0];
 assert.equal((await fetch(base+'/records',{headers:{Cookie:cookie}})).status,200);
 assert.equal((await post('/change-password',{currentPassword:password,newPassword:'A_New_Strong_Password_2026'}, {Cookie:cookie})).status,403);
 assert.equal((await post('/change-password',{currentPassword:password,newPassword:'A_New_Strong_Password_2026'}, {Cookie:cookie,'X-CSRF-Token':session.csrf})).status,200);
 assert.equal((await fetch(base+'/records',{headers:{Cookie:cookie}})).status,401);
 assert.equal((await post('/login',{email:'yenle.lhy@gmail.com',password})).status,401);
 assert.equal((await post('/login',{email:'yenle.lhy@gmail.com',password:'A_New_Strong_Password_2026'})).status,200);
 console.log('PASS: email login, single-use setup, protected records, CSRF, password change and cookie revocation');
 }finally{if(child)child.kill('SIGTERM');fs.rmSync(dir,{recursive:true,force:true});}
});
