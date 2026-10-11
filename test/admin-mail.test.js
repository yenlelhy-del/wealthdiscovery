'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {notice,sendAdminNotice}=require('../kyc-admin-mail');
test('Admin notification links to protected dashboard but excludes sensitive financial values',async()=>{
 const record={id:'FP-TEST123-ABCDEF1234',submittedAt:'2026-10-12T01:00:00.000Z',answers:{name:'Test User',email:'test@example.invalid',income:'PRIVATE INCOME',networth:'PRIVATE ASSETS',phone:'PRIVATE PHONE',notes:'PRIVATE NOTES'}};
 const mail=notice(record);
 assert.deepEqual(mail.to,['yenle.lhy@gmail.com','yenle@finpeace.vn']);
 assert.match(mail.text,/finpeace.cloud\/wealth-discovery\/admin\//);
 for(const value of ['PRIVATE INCOME','PRIVATE ASSETS','PRIVATE PHONE','PRIVATE NOTES'])assert.ok(!mail.text.includes(value));
 let delivered;
 const status=await sendAdminNotice(record,{transport:{sendMail:async m=>{delivered=m;}}});
 assert.equal(status,'sent');assert.deepEqual(delivered.to,['yenle.lhy@gmail.com','yenle@finpeace.vn']);
});
