const {test}=require('node:test'),assert=require('node:assert/strict');
const {canSend,notificationText}=require('../line-booking');
test('only explicitly authorized one-on-one LINE context can auto-send',()=>{
 assert.equal(canSend(true,{type:'utou'},['chat_message.write'],true),true);
 for(const type of ['external','group','room','none'])assert.equal(canSend(true,{type},['chat_message.write'],true),false);
 assert.equal(canSend(false,{type:'utou'},['chat_message.write'],true),false);
 assert.equal(canSend(true,{type:'utou'},[],true),false);
 assert.equal(canSend(true,{type:'utou'},['chat_message.write'],false),false);
});
test('notification contains booking identity and schedule, not private question or signature',()=>{
 const text=notificationText({id:'abc',date:'2026-11-06',time:'22:00',duration:10,price:300},'測試',{question:'私密問題',signature:'私密簽名'});
 assert(text.includes('abc')&&text.includes('22:00')&&text.includes('300'));
 assert(!text.includes('私密'));
});
