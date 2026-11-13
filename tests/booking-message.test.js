const test=require('node:test'),assert=require('node:assert/strict');
const {reference,message}=require('../booking-message');
test('approval and cancellation cards show short references and Taipei end time without private fields',()=>{
 const b={id:'12345678-abcd-4321-bbbb-111111111111',date:'2026-11-14',time:'19:00',endAt:Date.parse('2026-11-14T19:30:00+08:00'),duration:30,price:900,status:'confirmed',question:'PRIVATE',signature:'PRIVATE',lineIdentity:{userId:'PRIVATE'}};
 assert.equal(reference(b),'12345678ABCD');assert.equal(b.id.length,36);
 for(const status of ['confirmed','cancelled','pending']){const m=message({...b,status});assert.equal(m.type,'flex');assert.ok(m.altText.includes('19:00–19:30'));const json=JSON.stringify(m);assert.ok(json.includes(reference(b)));assert.ok(!json.includes(b.id));assert.ok(!json.includes('PRIVATE'));assert.ok(json.includes('NT$900'));}
});
