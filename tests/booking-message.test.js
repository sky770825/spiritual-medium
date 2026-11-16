const test=require('node:test'),assert=require('node:assert/strict');
const {reference,message}=require('../booking-message');
test('approval and cancellation cards show short references and Taipei end time without private fields',()=>{
 const b={id:'12345678-abcd-4321-bbbb-111111111111',date:'2026-11-14',time:'19:00',endAt:Date.parse('2026-11-14T19:30:00+08:00'),duration:30,price:900,status:'confirmed',question:'PRIVATE',signature:'PRIVATE',lineIdentity:{userId:'PRIVATE'}};
 assert.equal(reference(b),'12345678ABCD');assert.equal(b.id.length,36);
 for(const status of ['confirmed','cancelled','pending']){const m=message({...b,status});assert.equal(m.type,'flex');assert.ok(m.altText.includes('19:00–19:30'));const json=JSON.stringify(m);assert.ok(json.includes(reference(b)));assert.ok(!json.includes(b.id));assert.ok(!json.includes('PRIVATE'));assert.ok(json.includes('NT$900'));}
});
test('Flex footer offers booking actions instead of redundant official account inquiry',()=>{const b={id:'12345678-abcd-4321-bbbb-111111111111',date:'2026-11-17',time:'14:00',duration:10,price:300,status:'confirmed'};let m=message(b);assert.equal(m.contents.footer.contents.length,1);assert.match(m.contents.footer.contents[0].action.uri,/#manage=1$/);assert.ok(!JSON.stringify(m).includes('官方帳號洽詢'));m=message({...b,status:'cancelled'});assert.equal(m.contents.footer.contents[0].action.label,'重新預約');});
