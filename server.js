'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {adminRoute}=require('./admin');
const {sendReceipt}=require('./kyc-email');
const PORT=Number(process.env.PORT||3101);
const DATA_DIR=process.env.DATA_DIR||'/var/lib/finpeace-wealth-discovery';
const BASE='/wealth-discovery/';
const root=path.join(__dirname,'public');
const requests=new Map();
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function error(res,status,message){json(res,status,{ok:false,message});}
async function app(req,res){
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('X-Content-Type-Options','nosniff');
  const url=new URL(req.url,'http://localhost');
  if(await adminRoute(req,res,url))return;
  if(req.method==='GET'&&url.pathname===BASE+'health')return json(res,200,{ok:true});
  if(req.method==='POST'&&url.pathname===BASE+'api/submit'){
    if(req.headers.origin&&!['https://finpeace.cloud','https://www.finpeace.cloud'].includes(req.headers.origin))return error(res,403,'Origin không hợp lệ');
    if(!(req.headers['content-type']||'').startsWith('application/json'))return error(res,415,'Content-Type phải là JSON');
    const ip=req.socket.remoteAddress||'unknown',now=Date.now();
    const events=(requests.get(ip)||[]).filter(v=>now-v<3600000);
    if(events.length>=8)return error(res,429,'Vui lòng thử lại sau');
    events.push(now);requests.set(ip,events);
    let raw='';
    for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>24576)return error(res,413,'Dữ liệu quá lớn');}
    let d;try{d=JSON.parse(raw);}catch{return error(res,400,'JSON không hợp lệ');}
    if(!d||typeof d!=='object'||Array.isArray(d)||d.consent!==true||typeof d.name!=='string'||d.name.trim().length<2||d.name.length>120||typeof d.email!=='string'||d.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))return error(res,400,'Thiếu thông tin bắt buộc');
    const allowed=new Set(['name','email','phone','age','occupation','company','role','stage','trigger','scope','income','networth','savings','holdings','planning','goals','concerns','clarity','expectations','notes','consent','emailReceipt','website']);
    if(d.website)return error(res,400,'Yêu cầu không hợp lệ');
    for(const [k,v] of Object.entries(d)){if(!allowed.has(k))return error(res,400,'Trường dữ liệu không hợp lệ');if(Array.isArray(v)){if(v.length>15||!v.every(x=>typeof x==='string'&&x.length<250))return error(res,400,'Dữ liệu không hợp lệ');}else if(typeof v!=='string'&&typeof v!=='boolean')return error(res,400,'Dữ liệu không hợp lệ');else if(typeof v==='string'&&v.length>2200)return error(res,400,'Trường quá dài');}
    if((d.goals||[]).length>3||(d.concerns||[]).length>2||(d.expectations||[]).length>2)return error(res,400,'Quá số lựa chọn');
    const id='FP-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(5).toString('hex').toUpperCase();
    try{await fs.writeFile(path.join(DATA_DIR,id+'.json'),JSON.stringify({id,submittedAt:new Date().toISOString(),answers:d},null,2),{flag:'wx',mode:0o600});}
    catch(e){console.error('KYC storage error:',e.code);return error(res,500,'Chưa thể lưu hồ sơ');}
    let emailStatus='not-requested';
    if(d.emailReceipt===true){try{emailStatus=(await sendReceipt(d,id)).status;}catch(e){emailStatus='failed';console.error('KYC email send error:',e.message);}}
    return json(res,201,{ok:true,reference:id,emailStatus});
  }
  if(!['GET','HEAD'].includes(req.method))return error(res,405,'Method không hỗ trợ');
  const allowed={'/wealth-discovery/':['index.html','text/html; charset=utf-8'],'/wealth-discovery/index.html':['index.html','text/html; charset=utf-8'],'/wealth-discovery/logo-green.png':['logo-green.png','image/png']};
  if(!allowed[url.pathname])return error(res,404,'Không tìm thấy trang');
  const [file,type]=allowed[url.pathname];
  try{const content=await fs.readFile(path.join(root,file));res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'"});res.end(req.method==='HEAD'?undefined:content);}
  catch{return error(res,404,'Không tìm thấy tài nguyên');}
}
http.createServer((req,res)=>app(req,res).catch(e=>{console.error('Unexpected:',e.message);if(!res.headersSent)error(res,500,'Lỗi hệ thống');else res.end();})).listen(PORT,'127.0.0.1',()=>console.log('Wealth Discovery running on 127.0.0.1:'+PORT));
