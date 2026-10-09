'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const dir=process.env.DATA_DIR||'/var/lib/finpeace-wealth-discovery';
const file=path.join(dir,'admin-auth.json');
let a={version:0};
try{a=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(a.passwordHash){console.error('Admin đã thiết lập mật khẩu. Không cấp lại liên kết kích hoạt.');process.exit(1);}
const token=crypto.randomBytes(32).toString('base64url');
const tmp=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';
fs.writeFileSync(tmp,JSON.stringify({version:a.version||0,setupHash:crypto.createHash('sha256').update(token).digest('hex'),setupExpiry:Date.now()+15*60000}),{mode:0o600,flag:'wx'});
fs.renameSync(tmp,file);
console.log('LINK KÍCH HOẠT (hiệu lực 15 phút, chỉ dùng một lần):');
console.log('https://finpeace.cloud/wealth-discovery/admin/?setup='+encodeURIComponent(token));
console.log('Không gửi liên kết này cho người khác.');
