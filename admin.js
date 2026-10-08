'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const BASE='/wealth-discovery/admin';
const dataDir=process.env.DATA_DIR||'/var/lib/finpeace-wealth-discovery';
const COOKIE='fp_admin_session';
const secret=process.env.ADMIN_SESSION_SECRET||'';
const username=process.env.ADMIN_USERNAME||'';
const passwordHash=process.env.ADMIN_PASSWORD_SCRYPT||'';
const attempts=new Map();
const idOk=id=>/^FP-[A-Z0-9]+-[A-F0-9]{10}$/.test(id);
function response(res,status,body,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body));}
function deny(res,status=401){response(res,status,{ok:false,error:status===401?'Chưa đăng nhập':'Không được phép'});}
function cookieValue(req,key){const item=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='));return item?item.slice(key.length+1):'';}
function hmac(payload){return crypto.createHmac('sha256',secret).update(payload).digest('base64url');}
function safeEqual(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function session(req){if(!secret||secret.length<32)return null;const raw=cookieValue(req,COOKIE),parts=raw.split('.');if(parts.length!==3)return null;const [expires,nonce,signature]=parts,payload=expires+'.'+nonce;if(!safeEqual(signature,hmac(payload))||!/^\d+$/.test(expires)||Number(expires)<Date.now())return null;return {csrf:hmac('csrf.'+payload)};}
function originOK(req){const origin=req.headers.origin;return !origin||origin==='https://finpeace.cloud'||origin==='https://www.finpeace.cloud';}
function requireAdmin(req,res,mutate=false){const s=session(req);if(!s){deny(res);return null;}if(mutate&&(!originOK(req)||!safeEqual(req.headers['x-csrf-token']||'',s.csrf))){deny(res,403);return null;}return s;}
async function readJSON(req,max=8192){let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>max)throw new Error('Payload too large');}return JSON.parse(body);}
async function readRecord(id){if(!idOk(id))return null;try{const data=await fs.readFile(path.join(dataDir,id+'.json'),'utf8');return JSON.parse(data);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function getNotes(id){try{return JSON.parse(await fs.readFile(path.join(dataDir,'admin-notes',id+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {status:'new',notes:''};throw e;}}
const allowedStatuses=['new','reviewed','scheduled','completed'];
async function adminRoute(req,res,url){
 if(!url.pathname.startsWith(BASE))return false;
 if(url.pathname===BASE+'/api/login'&&req.method==='POST'){
  const key=req.socket.remoteAddress||'local',now=Date.now();
  const a=(attempts.get(key)||[]).filter(t=>now-t<15*60*1000);if(a.length>=5){response(res,429,{ok:false,error:'Quá nhiều lần thử. Hãy đợi 15 phút.'});return true;}
  attempts.set(key,a);
  if(!secret||secret.length<32||!username||!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash)){response(res,503,{ok:false,error:'Admin chưa được cấu hình'});return true;}
  if(!originOK(req)){deny(res,403);return true;}
  let d;try{d=await readJSON(req);}catch{response(res,400,{ok:false,error:'Dữ liệu không hợp lệ'});return true;}
  const [,salt,expected]=passwordHash.split(':');
  const computed=crypto.scryptSync(typeof d.password==='string'?d.password:'',Buffer.from(salt,'hex'),64);
  if(typeof d.username!=='string'||!safeEqual(d.username,username)||!crypto.timingSafeEqual(computed,Buffer.from(expected,'hex'))){a.push(now);attempts.set(key,a);response(res,401,{ok:false,error:'Thông tin đăng nhập không đúng'});return true;}
  attempts.delete(key);
  const expires=String(now+8*60*60*1000),nonce=crypto.randomBytes(24).toString('base64url'),payload=expires+'.'+nonce;
  const token=payload+'.'+hmac(payload);
  response(res,200,{ok:true,csrf:hmac('csrf.'+payload)},{'Set-Cookie':COOKIE+'='+token+'; HttpOnly; Secure; SameSite=Strict; Path='+BASE+'; Max-Age=28800'});return true;
 }
 if(url.pathname===BASE+'/api/session'&&req.method==='GET'){const s=session(req);response(res,200,{ok:!!s,csrf:s?.csrf||null});return true;}
 if(url.pathname===BASE+'/api/logout'&&req.method==='POST'){if(!requireAdmin(req,res,true))return true;response(res,200,{ok:true},{'Set-Cookie':COOKIE+'=; HttpOnly; Secure; SameSite=Strict; Path='+BASE+'; Max-Age=0'});return true;}
 if(url.pathname===BASE+'/api/records'&&req.method==='GET'){
  if(!requireAdmin(req,res))return true;
  const files=(await fs.readdir(dataDir)).filter(f=>/^FP-[A-Z0-9]+-[A-F0-9]{10}\.json$/.test(f)).sort().reverse().slice(0,250);
  const records=[];for(const file of files){try{const d=JSON.parse(await fs.readFile(path.join(dataDir,file),'utf8'));const review=await getNotes(d.id);records.push({id:d.id,submittedAt:d.submittedAt,name:d.answers?.name||'',email:d.answers?.email||'',occupation:d.answers?.occupation||'',goals:d.answers?.goals||[],status:review.status});}catch{/* skip corrupted record */}}
  response(res,200,{ok:true,records});return true;
 }
 const match=url.pathname.match(/^\/wealth-discovery\/admin\/api\/records\/(FP-[A-Z0-9]+-[A-F0-9]{10})$/);
 if(match){
  if(!requireAdmin(req,res,req.method==='PATCH'))return true;
  const id=match[1],record=await readRecord(id);if(!record){response(res,404,{ok:false,error:'Không tìm thấy hồ sơ'});return true;}
  if(req.method==='GET'){response(res,200,{ok:true,record,review:await getNotes(id)});return true;}
  if(req.method==='PATCH'){
   let d;try{d=await readJSON(req);}catch{response(res,400,{ok:false,error:'JSON không hợp lệ'});return true;}
   if(typeof d.notes!=='string'||d.notes.length>6000||!allowedStatuses.includes(d.status)){response(res,400,{ok:false,error:'Nội dung không hợp lệ'});return true;}
   const dir=path.join(dataDir,'admin-notes');await fs.mkdir(dir,{recursive:true,mode:0o700});
   const tmp=path.join(dir,id+'.'+crypto.randomBytes(8).toString('hex')+'.tmp');
   const doc={notes:d.notes,status:d.status,updatedAt:new Date().toISOString()};
   await fs.writeFile(tmp,JSON.stringify(doc),{mode:0o600,flag:'wx'});await fs.rename(tmp,path.join(dir,id+'.json'));
   response(res,200,{ok:true,review:doc});return true;
  }
 }
 if(url.pathname===BASE+'/'||url.pathname===BASE){
  if(!['GET','HEAD'].includes(req.method)){deny(res,405);return true;}
  const html=await fs.readFile(path.join(__dirname,'public','admin.html'));
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:html);return true;
 }
 deny(res,404);return true;
}
module.exports={adminRoute};
