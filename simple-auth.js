'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=process.env.DATA_DIR||'/var/lib/finpeace-wealth-discovery';
const FILE=path.join(ROOT,'admin-auth.json');
const EMAIL='yenle.lhy@gmail.com';
const COOKIE='fp_admin_session';
const BASE='/wealth-discovery/admin';
const secret=process.env.ADMIN_SESSION_SECRET||'';
const attempts=new Map();
const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);};
const hashToken=t=>crypto.createHash('sha256').update(t).digest('hex');
const sign=s=>crypto.createHmac('sha256',secret).update(s).digest('base64url');
function send(res,status,obj,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(obj));}
function originOK(req){return !req.headers.origin||['https://finpeace.cloud','https://www.finpeace.cloud'].includes(req.headers.origin)||(process.env.NODE_ENV==='test'&&req.headers.origin==='http://localhost');}
async function readAccount(){try{return JSON.parse(await fs.readFile(FILE,'utf8'));}catch(e){if(e.code==='ENOENT')return {version:0};throw e;}}
async function saveAccount(a){const tmp=FILE+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';await fs.writeFile(tmp,JSON.stringify(a),{flag:'wx',mode:0o600});await fs.rename(tmp,FILE);}
function validHash(h){return typeof h==='string'&&/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(h);}
function encodePassword(p){const salt=crypto.randomBytes(16);return 'scrypt:'+salt.toString('hex')+':'+crypto.scryptSync(p,salt,64).toString('hex');}
function verifyPassword(p,h){if(!validHash(h))return false;const [,salt,hex]=h.split(':');return crypto.timingSafeEqual(crypto.scryptSync(p,Buffer.from(salt,'hex'),64),Buffer.from(hex,'hex'));}
function throttle(label,limit,interval){const now=Date.now(),a=(attempts.get(label)||[]).filter(t=>now-t<interval);if(a.length>=limit)return false;a.push(now);attempts.set(label,a);return true;}
function cookieValue(req){return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
async function session(req){if(secret.length<32)return null;const parts=cookieValue(req).split('.');if(parts.length!==4)return null;const [expiry,version,nonce,signature]=parts;const payload=[expiry,version,nonce].join('.');if(!/^\d+$/.test(expiry)||Number(expiry)<Date.now()||!equal(signature,sign(payload)))return null;const a=await readAccount();if(!validHash(a.passwordHash)||String(a.version)!==version)return null;return {csrf:sign('csrf.'+payload)};}
async function requireAuth(req,res,mutate=false){const s=await session(req);if(!s){send(res,401,{ok:false,error:'Chưa đăng nhập'});return null;}if(mutate&&(!originOK(req)||!equal(req.headers['x-csrf-token']||'',s.csrf))){send(res,403,{ok:false,error:'Không được phép'});return null;}return s;}
async function parse(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Error('json required');let raw='';for await(const x of req){raw+=x;if(Buffer.byteLength(raw)>8192)throw Error('large');}return JSON.parse(raw);}
let busy=false;
async function authRoute(req,res,url){
 const p=url.pathname;
 if(!p.startsWith(BASE+'/api/'))return false;
 const action=p.slice((BASE+'/api/').length);
 if(['setup','login','change-password','logout'].includes(action)&&req.method==='POST'&&!originOK(req)){send(res,403,{ok:false,error:'Nguồn yêu cầu không hợp lệ'});return true;}
 if(action==='setup'&&req.method==='POST'){
  if(!throttle('setup',10,3600000)){send(res,429,{ok:false,error:'Thử lại sau'});return true;}
  let d;try{d=await parse(req);}catch{send(res,400,{ok:false,error:'Dữ liệu không hợp lệ'});return true;}
  if(typeof d.token!=='string'||d.token.length>180||typeof d.password!=='string'||d.password.length<16||d.password.length>128){send(res,400,{ok:false,error:'Mật khẩu cần 16–128 ký tự'});return true;}
  if(busy){send(res,409,{ok:false,error:'Thử lại sau'});return true;}busy=true;
  try{
   const a=await readAccount();
   if(validHash(a.passwordHash)||!a.setupHash||a.setupExpiry<Date.now()||!equal(hashToken(d.token),a.setupHash)){send(res,400,{ok:false,error:'Liên kết kích hoạt không hợp lệ hoặc đã hết hạn'});return true;}
   await saveAccount({version:(a.version||0)+1,email:EMAIL,passwordHash:encodePassword(d.password),updatedAt:new Date().toISOString()});
   send(res,200,{ok:true});return true;
  }finally{busy=false;}
 }
 if(action==='login'&&req.method==='POST'){
  if(!throttle('login',10,15*60000)){send(res,429,{ok:false,error:'Thử lại sau 15 phút'});return true;}
  let d;try{d=await parse(req);}catch{send(res,400,{ok:false,error:'Dữ liệu không hợp lệ'});return true;}
  if(secret.length<32){send(res,503,{ok:false,error:'Chưa cấu hình xác thực'});return true;}
  const a=await readAccount();
  if(typeof d.email!=='string'||d.email.trim().toLowerCase()!==EMAIL||typeof d.password!=='string'||!verifyPassword(d.password,a.passwordHash)){send(res,401,{ok:false,error:'Email hoặc mật khẩu không đúng'});return true;}
  const expiry=String(Date.now()+8*3600000),nonce=crypto.randomBytes(20).toString('base64url'),payload=expiry+'.'+a.version+'.'+nonce;
  send(res,200,{ok:true,csrf:sign('csrf.'+payload)},{'Set-Cookie':COOKIE+'='+payload+'.'+sign(payload)+'; HttpOnly; Secure; SameSite=Strict; Path='+BASE+'; Max-Age=28800'});return true;
 }
 if(action==='session'&&req.method==='GET'){const s=await session(req);send(res,200,{ok:!!s,csrf:s?.csrf||null});return true;}
 if(action==='change-password'&&req.method==='POST'){
  if(!await requireAuth(req,res,true))return true;
  if(!throttle('change',8,3600000)){send(res,429,{ok:false,error:'Thử lại sau'});return true;}
  let d;try{d=await parse(req);}catch{send(res,400,{ok:false,error:'Dữ liệu không hợp lệ'});return true;}
  if(typeof d.currentPassword!=='string'||typeof d.newPassword!=='string'||d.newPassword.length<16||d.newPassword.length>128){send(res,400,{ok:false,error:'Mật khẩu cần 16–128 ký tự'});return true;}
  if(busy){send(res,409,{ok:false,error:'Thử lại sau'});return true;}busy=true;
  try{
   const a=await readAccount();if(!verifyPassword(d.currentPassword,a.passwordHash)){send(res,403,{ok:false,error:'Mật khẩu hiện tại không đúng'});return true;}
   await saveAccount({email:EMAIL,version:(a.version||0)+1,passwordHash:encodePassword(d.newPassword),updatedAt:new Date().toISOString()});
   send(res,200,{ok:true,message:'Đã đổi mật khẩu, vui lòng đăng nhập lại'},{'Set-Cookie':COOKIE+'=; HttpOnly; Secure; SameSite=Strict; Path='+BASE+'; Max-Age=0'});return true;
  }finally{busy=false;}
 }
 if(action==='logout'&&req.method==='POST'){
  if(!await requireAuth(req,res,true))return true;
  send(res,200,{ok:true},{'Set-Cookie':COOKIE+'=; HttpOnly; Secure; SameSite=Strict; Path='+BASE+'; Max-Age=0'});return true;
 }
 return false;
}
module.exports={authRoute,requireAuth};
