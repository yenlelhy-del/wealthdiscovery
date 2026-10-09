'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {receipt,sendReceipt}=require('../kyc-email');
test('receipt excludes financial values and escapes unsafe input',async()=>{
 const answers={name:'Test <Client>',email:'client@example.test',income:'Sensitive income',networth:'Sensitive net worth',goals:['Tích lũy','An tâm'],expectations:['Làm rõ mục tiêu'],emailReceipt:true};
 const content=receipt(answers,'FP-TEST123-ABCDEF1234');
 assert.match(content.html,/Tích lũy/);
 assert.match(content.html,/FP-TEST123-ABCDEF1234/);
 assert.doesNotMatch(content.html,/Sensitive income|Sensitive net worth|<Client>/);
 assert.doesNotMatch(content.text,/Sensitive income|Sensitive net worth/);
 let message;
 const transport={sendMail:async data=>{message=data;}};
 assert.deepEqual(await sendReceipt(answers,'FP-TEST123-ABCDEF1234',{transporter:transport}),{status:'sent'});
 assert.equal(message.to,'client@example.test');
 assert.equal(message.subject.startsWith('FinPeace'),true);
 assert.equal((await sendReceipt({...answers,emailReceipt:false},'FP-TEST123-ABCDEF1234',{transporter:transport})).status,'not-requested');
 console.log('PASS: email receipt contents, HTML escaping, explicit opt-in and fake SMTP.');
});
