'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const BASE='/wealth-discovery/admin';
const DIR=process.env.DATA_DIR||'/var/lib/finpeace-wealth-discovery';
const ADMIN_EMAIL='yenle.lhy@gmail.com';
const AUTH_FILE=path.join(DIR,'admin-account.json');
const secret=process.env.ADMIN_SESSION_SECRET||'';
const cookie='fp_admin_session';
const limits=new Map();
let busy=false;
const limit=(key,count,window)=>{const now=Date.now(),items=(limits.get(key)||[]).filter(t=>now-t<window);if(items.length>=count)return false;items.push(now);limits.set(key,items);return true;};
const safe=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);};
const sign=s=>crypto.createHmac('sha256',secret).update(s).digest('base64url');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const present=(res,status,body,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body));};
const originOK=req=>!req.headers.origin||['https://finpeace.cloud','https://www.finpeace.cloud'].includes(req.headers.origin)||(process.env.NODE_ENV==='test'&&req.headers.origin==='http://localhost');
async function body(req,max=8192){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>max)throw Error('too large');}return JSON.parse(raw);}
async function account(){try{return JSON.parse(await fs.readFile(AUTH_FILE,'utf8'));}catch(e){if(e.code==='ENOENT')return {version:0,email:ADMIN_EMAIL};throw e;}}
async function save(a){const tmp=AUTH_FILE+'.'+crypto.randomBytes(12).toString('hex')+'.tmp';await fs.writeFile(tmp,JSON.stringify(a),{mode:0o600,flag:'wx'});await fs.rename(tmp,AUTH_FILE);}
function validHash(h){return typeof h==='string'&&/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/.test(h);}
function hashPassword(p){const salt=crypto.randomBytes(16);return 'scrypt:'+salt.toString('hex')+':'+crypto.scryptSync(p,salt,64).toString('hex');}
function verify(p,hash){if(!validHash(hash))return false;const [,salt,expected]=hash.split(':');const v=crypto.scryptSync(p,Buffer.from(salt,'hex'),64);return crypto.timingSafeEqual(v,Buffer.from(expected,'hex'));}
function rawCookie(req){return(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookie+'='))?.slice(cookie.length+1)||'';}
async function session(req){
 if(secret.length<32)return null;
 const parts=rawCookie(req).split('.');if(parts.length!==4)return null;
 const [expires,version,nonce,mac]=parts;
 if(!/^\d+$/.test(expires)||Number(expires)<=Date.now()||!safe(mac,sign([expires,version,nonce].join('.'))))return null;
 const a=await account();if(!validHash(a.passwordHash)||String(a.version)!==version)return null;
 return {csrf:sign('csrf.'+[expires,version,nonce].join('.'))};
}
function cookieFor(a){const expires=String(Date.now()+8*3600000),nonce=crypto.randomBytes(24).toString('base64url'),payload=[expires,String(a.version),nonce].join('.');
 return {cookie:cookie+'='+payload+'.'+sign(payload)+'; HttpOnly; Secure; SameSite=Strict; Path='+BASE+'; Max-Age=28800',csrf:sign('csrf.'+payload)};
}
async function deliver(token,kind){
 const key=process.env.RESEND_API_KEY||'',from=process.env.MAIL_FROM||'';
 if(!key||!from)throw Error('Mail delivery not configured');
 const link='https://finpeace.cloud/wealth-discovery/admin/?action=reset&token='+encodeURIComponent(token);
 const subject=kind==='setup'?'FinPeace — Kích hoạt tài khoản Admin':'FinPeace — Đặt lại mật khẩu Admin';
 const html='<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>FinPeace Coach Workspace</h2><p>Liên kết '+(kind==='setup'?'thiết lập':'đặt lại')+' mật khẩu của bạn, chỉ sử dụng một lần và hết hạn sau 30 phút.</p><p><a href="'+link+'">Thiết lập mật khẩu</a></p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này. Không chuyển tiếp liên kết cho người khác.</p></div>';
 const api=process.env.NODE_ENV==='test'&&process.env.TEST_MAIL_URL?process.env.TEST_MAIL_URL:'https://api.resend.com/emails';
 const r=await fetch(api,{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[ADMIN_EMAIL],subject,html})});
 if(!r.ok)throw Error('Email provider rejected request '+r.status);
}
async function route(req,res,url){
 if(!url.pathname.startsWith(BASE+'/api/'))return false;
 const action=url.pathname.slice((BASE+'/api/').length);
 if(['request-link','reset-password','login','logout'].includes(action)&&req.method==='POST'&&!originOK(req)){present(res,403,{ok:false,error:'Yêu cầu không hợp lệ'});return true;}
 if(action==='request-link'&&req.method==='POST'){
  let d;try{d=await body(req);}catch{present(res,400,{ok:false,error:'Dữ liệu không hợp lệ'});return true;}
  const generic='Nếu email được xác nhận, bạn sẽ nhận được hướng dẫn trong ít phút.';
  if(typeof d.email!=='string'||d.email.toLowerCase().trim()!==ADMIN_EMAIL||!limit('request-link',3,3600000)){present(res,200,{ok:true,message:generic});return true;}
  if(busy){present(res,200,{ok:true,message:generic});return true;}busy=true;
  try{
   const a=await account(),token=crypto.randomBytes(32).toString('base64url');
   const next={...a,email:ADMIN_EMAIL,resetHash:digest(token),resetExpires:Date.now()+30*60000};
   await deliver(token,validHash(a.passwordHash)?'reset':'setup');
   await save(next);
  }catch(e){console.error('Password email error:',e.message);}
  finally{busy=false;}
  present(res,200,{ok:true,message:generic});return true;
 }
 if(action==='reset-password'&&req.method==='POST'){
  let d;try{d=await body(req);}catch{present(res,400,{ok:false,error:'Dữ liệu không hợp lệ'});return true;}
  if(!limit('reset-attempts',10,3600000)){present(res,429,{ok:false,error:'Vui lòng thử lại sau'});return true;}
  if(typeof d.token!=='string'||d.token.length>160||typeof d.password!=='string'||d.password.length<16||d.password.length>128){present(res,400,{ok:false,error:'Mật khẩu cần 16–128 ký tự'});return true;}
  if(busy){present(res,409,{ok:false,error:'Vui lòng thử lại'});return true;}busy=true;
  try{
   const a=await account();
   if(!a.resetHash||!a.resetExpires||a.resetExpires<Date.now()||!safe(digest(d.token),a.resetHash)){present(res,400,{ok:false,error:'Liên kết không hợp lệ hoặc đã hết hạn'});return true;}
   const updated={email:ADMIN_EMAIL,version:(a.version||0)+1,passwordHash:hashPassword(d.password),changedAt:new Date().toISOString()};
   await save(updated);
   present(res,200,{ok:true,message:'Đã đặt mật khẩu. Vui lòng đăng nhập.'});return true;
  }finally{busy=false;}
 }
 if(action==='login'&&req.method==='POST'){
  if(!limit('login-attempts',10,15*60000)){present(res,429,{ok:false,error:'Thử lại sau 15 phút'});return true;}
  if(secret.length<32){present(res,503,{ok:false,error:'Đăng nhập chưa được cấu hình'});return true;}
  let d;try{d=await body(req);}catch{present(res,400,{ok:false,error:'Dữ liệu không hợp lệ'});return true;}
  const a=await account(),pass=typeof d.password==='string'?d.password:'';
  const match=typeof d.email==='string'&&d.email.toLowerCase().trim()===ADMIN_EMAIL&&validHash(a.passwordHash)&&verify(pass,a.passwordHash);
  if(!match){present(res,401,{ok:false,error:'Email hoặc mật khẩu không đúng'});return true;}
  const s=cookieFor(a);present(res,200,{ok:true,csrf:s.csrf},{'Set-Cookie':s.cookie});return true;
 }
 if(action==='session'&&req.method==='GET'){const s=await session(req);present(res,200,{ok:!!s,csrf:s?.csrf||null});return true;}
 if(action==='logout'&&req.method==='POST'){
  const s=await session(req);if(!s||!safe(req.headers['x-csrf-token']||'',s.csrf)){present(res,403,{ok:false});return true;}
  present(res,200,{ok:true},{'Set-Cookie':cookie+'=; HttpOnly; Secure; SameSite=Strict; Path='+BASE+'; Max-Age=0'});return true;
 }
 return false;
}
module.exports={route,session,safe,originOK};
