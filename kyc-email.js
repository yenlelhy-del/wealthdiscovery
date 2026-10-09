'use strict';
const nodemailer=require('nodemailer');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=v=>Array.isArray(v)?v.filter(x=>typeof x==='string').join(' · '):String(v||'');
const approvedFields=[
 ['Nghề nghiệp / vai trò','occupation'],
 ['Giai đoạn hiện tại','stage'],
 ['Điều bạn đang quan tâm','trigger'],
 ['Mục tiêu ưu tiên','goals'],
 ['Điều bạn băn khoăn','concerns'],
 ['Kỳ vọng buổi coaching','expectations']
];
function receipt(d,id){
 const name=escape(d.name),reference=escape(id);
 const rows=approvedFields.filter(([,key])=>list(d[key])).map(([title,key])=>'<tr><td style="padding:10px 0;color:#577165;vertical-align:top;width:38%;border-bottom:1px solid #e5ece6">'+escape(title)+'</td><td style="padding:10px 0;color:#163a2c;border-bottom:1px solid #e5ece6">'+escape(list(d[key]))+'</td></tr>').join('');
 return {subject:'FinPeace | Xác nhận hồ sơ Wealth Discovery — '+id,
 text:'FinPeace đã nhận hồ sơ Wealth Discovery của bạn.\nXin chào '+d.name+',\nMã hồ sơ: '+id+'\n\n'+approvedFields.filter(([,k])=>list(d[k])).map(([t,k])=>t+': '+list(d[k])).join('\n')+'\n\nCảm ơn bạn đã chia sẻ. Financial Coach sẽ sử dụng thông tin để chuẩn bị buổi gặp. Email này không phải khuyến nghị đầu tư.\nKhông trả lời email này với dữ liệu tài chính nhạy cảm.',
 html:'<div style="font-family:Arial,sans-serif;background:#f8faf6;padding:32px 18px;color:#203e31"><div style="max-width:620px;margin:auto;background:#fff;border:1px solid #dce8df;border-radius:16px;padding:30px"><div style="font-size:24px;color:#00c878;font-weight:800">FinPeace</div><p style="font-size:11px;letter-spacing:2px;color:#16865b">WEALTH DISCOVERY · BEFORE WE MEET</p><h1 style="font-size:27px;color:#20382c">Cảm ơn bạn đã chia sẻ!</h1><p>Xin chào '+name+',</p><p>FinPeace đã nhận được hồ sơ chuẩn bị cho buổi Strategic Financial Coaching của bạn.</p><p style="background:#eef7f0;border-radius:8px;padding:13px">Mã hồ sơ: <b>'+reference+'</b></p><h2 style="font-size:17px">Những điều bạn đã chia sẻ</h2><table width="100%" cellspacing="0" style="font-size:14px;border-collapse:collapse">'+rows+'</table><p>Financial Coach sẽ sử dụng thông tin để chuẩn bị cuộc gặp, cùng bạn làm rõ mục tiêu, ưu tiên và hành trình xây dựng tài sản.</p><p style="font-size:12px;color:#667b6d">Để bảo vệ quyền riêng tư, bản email này không bao gồm thu nhập, tài sản ròng hoặc các thông tin tài chính định lượng bạn đã cung cấp. Không gửi mật khẩu, số tài khoản hay giấy tờ tùy thân qua email. Đây không phải là khuyến nghị đầu tư.</p><p style="font-size:13px;color:#176846">FinPeace · Your Wealth. Your Next Chapter.</p></div></div>'};
}
function smtpReady(){return !!(process.env.KYC_SMTP_HOST&&process.env.KYC_SMTP_USER&&process.env.KYC_SMTP_PASS&&process.env.KYC_MAIL_FROM);}
async function sendReceipt(d,id,{transporter}={}){
 if(d.emailReceipt!==true)return {status:'not-requested'};
 if(!transporter&&!smtpReady())return {status:'not-configured'};
 const options=receipt(d,id);
 const sender=transporter||nodemailer.createTransport({host:process.env.KYC_SMTP_HOST,port:Number(process.env.KYC_SMTP_PORT||465),secure:Number(process.env.KYC_SMTP_PORT||465)===465,auth:{user:process.env.KYC_SMTP_USER,pass:process.env.KYC_SMTP_PASS},connectionTimeout:7000,greetingTimeout:7000,socketTimeout:7000});
 await sender.sendMail({from:process.env.KYC_MAIL_FROM||'FinPeace <test@example.invalid>',to:d.email,subject:options.subject,text:options.text,html:options.html});
 return {status:'sent'};
}
module.exports={receipt,sendReceipt,smtpReady};
