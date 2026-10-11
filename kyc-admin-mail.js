'use strict';
const https=require('node:https');
const ADMIN_EMAILS=['yenle.lhy@gmail.com','yenle@finpeace.vn'];
function config(){return {host:process.env.KYC_SMTP_HOST,port:process.env.KYC_SMTP_PORT,user:process.env.KYC_SMTP_USER,pass:process.env.KYC_SMTP_PASS,from:process.env.KYC_MAIL_FROM};}
function configured(){const c=config();return !!(c.host&&c.port&&c.user&&c.pass&&c.from);}
function notice(record){
 const name=String(record.answers?.name||'Khách hàng').replace(/[\r\n]/g,' ').slice(0,120);
 const id=record.id;
 const dashboard='https://finpeace.cloud/wealth-discovery/admin/';
 return {
  to:ADMIN_EMAILS,
  subject:'FinPeace | Hồ sơ Wealth Discovery mới — '+id,
  text:'FinPeace vừa nhận một hồ sơ Wealth Discovery mới.\n\nKhách hàng: '+name+'\nMã hồ sơ: '+id+'\nThời điểm: '+record.submittedAt+'\n\nĐăng nhập Coach Dashboard để xem toàn bộ thông tin tài chính, mục tiêu và kỳ vọng khách hàng:\n'+dashboard+'\n\nĐể bảo vệ dữ liệu khách hàng, hồ sơ tài chính đầy đủ không được gửi dưới dạng email.'
 };
}
async function sendAdminNotice(record,options={}){
 if(!configured()&&!options.transport)return 'not-configured';
 const transporter=options.transport||require('nodemailer').createTransport({host:process.env.KYC_SMTP_HOST,port:Number(process.env.KYC_SMTP_PORT),secure:Number(process.env.KYC_SMTP_PORT)===465,auth:{user:process.env.KYC_SMTP_USER,pass:process.env.KYC_SMTP_PASS},connectionTimeout:7000,socketTimeout:7000});
 await transporter.sendMail({from:process.env.KYC_MAIL_FROM||'FinPeace <info@finpeace.vn>',...notice(record)});
 return 'sent';
}
module.exports={notice,sendAdminNotice,configured};
