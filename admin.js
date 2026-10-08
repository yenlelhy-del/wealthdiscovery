'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const BASE='/wealth-discovery/admin';
const dataDir=process.env.DATA_DIR||'/var/lib/finpeace-wealth-discovery';
const {route:emailRoute,session,safe,originOK}=require('./email-auth');
async function requireAdmin(req,res,mutate=false){const state=await session(req);if(!state){response(res,401,{ok:false,error:'Chưa đăng nhập'});return null;}if(mutate&&(!originOK(req)||!safe(req.headers['x-csrf-token']||'',state.csrf))){response(res,403,{ok:false,error:'Không được phép'});return null;}return state;}
function response(res,status,body,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body));}
function deny(res,status=401){response(res,status,{ok:false,error:status===401?'Chưa đăng nhập':'Không được phép'});}
async function readJSON(req,max=8192){let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>max)throw new Error('Payload too large');}return JSON.parse(body);}
async function readRecord(id){if(!idOk(id))return null;try{const data=await fs.readFile(path.join(dataDir,id+'.json'),'utf8');return JSON.parse(data);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function getNotes(id){try{return JSON.parse(await fs.readFile(path.join(dataDir,'admin-notes',id+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {status:'new',notes:''};throw e;}}
const allowedStatuses=['new','reviewed','scheduled','completed'];
async function adminRoute(req,res,url){
 if(!url.pathname.startsWith(BASE))return false;
 if(await emailRoute(req,res,url))return true;
 if(url.pathname===BASE+'/api/records'&&req.method==='GET'){
  if(!await requireAdmin(req,res))return true;
  const files=(await fs.readdir(dataDir)).filter(f=>/^FP-[A-Z0-9]+-[A-F0-9]{10}\.json$/.test(f)).sort().reverse().slice(0,250);
  const records=[];for(const file of files){try{const d=JSON.parse(await fs.readFile(path.join(dataDir,file),'utf8'));const review=await getNotes(d.id);records.push({id:d.id,submittedAt:d.submittedAt,name:d.answers?.name||'',email:d.answers?.email||'',occupation:d.answers?.occupation||'',goals:d.answers?.goals||[],status:review.status});}catch{/* skip corrupted record */}}
  response(res,200,{ok:true,records});return true;
 }
 const match=url.pathname.match(/^\/wealth-discovery\/admin\/api\/records\/(FP-[A-Z0-9]+-[A-F0-9]{10})$/);
 if(match){
  if(!await requireAdmin(req,res,req.method==='PATCH'))return true;
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
