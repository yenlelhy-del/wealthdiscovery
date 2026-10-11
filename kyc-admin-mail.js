'use strict';
const https=require('node:https');
const ADMIN_EMAILS=['yenle.lhy@gmail.com','yenle@finpeace.vn'];
function config(){return {host:process.env.KYC_SMTP_HOST,port:process.env.KYC_SMTP_PORT,user:process.env.KYC_SMTP_USER,pass:process.env.KYC_SMTP_PASS,from:process.env.KYC_MAIL_FROM};}
function configured(){const c=config();return !!(c.host&&c.port&&c.user&&c.pass&&c.from);}
const FIELDS=[
 ['01 / Thông tin cá nhân',[['name','Họ và tên'],['email','Email'],['phone','Số điện thoại'],['age','Độ tuổi']]],
 ['02 / Bối cảnh nghề nghiệp',[['occupation','Nghề nghiệp / vị trí'],['company','Công ty / tổ chức'],['role','Vai trò công việc'],['stage','Giai đoạn cuộc sống'],['trigger','Lý do tìm đến FinPeace'],['scope','Phạm vi tài chính']]],
 ['03 / Bức tranh tài chính',[['income','Thu nhập'],['networth','Tài sản ròng'],['savings','Tỷ lệ tích lũy'],['holdings','Tài sản / sản phẩm'],['planning','Kế hoạch tài chính']]],
 ['04 / Mục tiêu & kỳ vọng',[['goals','Mục tiêu'],['concerns','Băn khoăn'],['clarity','Financial Clarity'],['expectations','Kỳ vọng coaching'],['notes','Chia sẻ bổ sung']]]
];
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const display=value=>Array.isArray(value)?value.join(' · '):String(value??'');
function notice(record){
 const answers=record.answers||{};
 const rows=FIELDS.map(([section,fields])=>{
 const entries=fields.map(([key,label])=>({label,value:display(answers[key])})).filter(v=>v.value.trim());
 return {section,entries};
 }).filter(group=>group.entries.length);
 const safeId=escapeHtml(record.id),date=new Date(record.submittedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
 const intro='FinPeace vừa nhận một hồ sơ Wealth Discovery mới.';
 const text=intro+'\\nMã hồ sơ: '+record.id+'\\nGửi lúc: '+date+'\\n\\n'+rows.map(group=>group.section+'\\n'+group.entries.map(e=>e.label+': '+e.value).join('\\n')).join('\\n\\n')+'\\n\\nBản gốc được lưu tại: https://finpeace.cloud/wealth-discovery/admin/\\nThông tin bảo mật dành riêng cho Admin FinPeace. Không chuyển tiếp email này.';
 const sections=rows.map(g=>'<h2 style="font-size:16px;color:#146949;margin:28px 0 8px">'+escapeHtml(g.section)+'</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">'+g.entries.map((e,i)=>'<tr style="background:'+(i%2?'#f7faf7':'#fff')+'"><td style="padding:10px;border-bottom:1px solid #e5eee8;color:#516c60;width:35%;vertical-align:top">'+escapeHtml(e.label)+'</td><td style="padding:10px;border-bottom:1px solid #e5eee8;color:#193b2c;white-space:pre-wrap;overflow-wrap:anywhere">'+escapeHtml(e.value)+'</td></tr>').join('')+'</table>').join('');
 const html='<div style="background:#f8faf6;padding:22px;font-family:Arial,sans-serif;color:#17372a"><div style="max-width:720px;margin:auto;background:#fff;border:1px solid #dfe8df;border-radius:14px;padding:28px"><div style="font-size:28px;letter-spacing:-1px;font-weight:800;color:#00be71">FinPeace</div><div style="font-size:11px;letter-spacing:2px;color:#14855d">WEALTH DISCOVERY / CLIENT INTAKE</div><h1 style="font-size:25px;margin-top:22px">Hồ sơ khách hàng mới</h1><p>'+intro+'</p><div style="background:#ecf7ef;padding:14px;border-radius:8px">Mã hồ sơ: <b>'+safeId+'</b><p style="margin-bottom:0">Gửi lúc: '+escapeHtml(date)+'</p></div>'+sections+'<p style="margin-top:26px"><a href="https://finpeace.cloud/wealth-discovery/admin/" style="color:#007d56">Mở Coach Dashboard</a></p><p style="font-size:12px;color:#63786b">Chỉ dành cho Admin FinPeace. Có dữ liệu tài chính cá nhân — không chuyển tiếp hoặc chia sẻ email này.</p></div></div>';
 return {to:ADMIN_EMAILS,subject:'FinPeace | Hồ sơ KYC mới — '+record.id,text,html};
}
async function sendAdminNotice(record,options={}){
 if(!configured()&&!options.transport)return 'not-configured';
 const transporter=options.transport||require('nodemailer').createTransport({host:process.env.KYC_SMTP_HOST,port:Number(process.env.KYC_SMTP_PORT),secure:Number(process.env.KYC_SMTP_PORT)===465,auth:{user:process.env.KYC_SMTP_USER,pass:process.env.KYC_SMTP_PASS},connectionTimeout:7000,socketTimeout:7000});
 await transporter.sendMail({from:process.env.KYC_MAIL_FROM||'FinPeace <info@finpeace.vn>',...notice(record)});
 return 'sent';
}
module.exports={notice,sendAdminNotice,configured};
