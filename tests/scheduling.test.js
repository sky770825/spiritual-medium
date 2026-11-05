const {test}=require('node:test');
const assert=require('node:assert/strict');
const {defaultState,slotsForDay,reserve,validateConfig,transition}=require('../server/scheduling');
const now=Date.parse('2026-11-05T08:00:00+08:00');
const request=(time='14:00',duration=20)=>({date:'2026-11-06',time,duration,name:'測試',contact:'測試LINE名稱',question:'',signature:'測試',consent:true,requestId:crypto.randomUUID()});
test('only 10/20/30 minute appointments; lead time and buffer must fit hours',()=>{
 const s=defaultState(); assert.throws(()=>slotsForDay(s,'2026-11-06',40,now));
 const slots=slotsForDay(s,'2026-11-06',30,now);
 assert(slots.some(x=>x.time==='14:00')); assert(!slots.some(x=>x.time==='17:30'));
 assert(!slotsForDay(s,'2026-11-05',10,Date.parse('2026-11-05T13:30:00+08:00')).some(x=>x.time==='14:00'));
});
test('first booking locks service plus buffer; cancellation releases it',()=>{
 const s=defaultState();const b=reserve(s,request(),now,'clientA');
 assert.equal(b.price,600);assert.equal(b.status,'pending');
 assert.throws(()=>reserve(s,request('14:20',10),now,'clientB'),/時段/);
 assert(slotsForDay(s,'2026-11-06',10,now).some(x=>x.time==='14:30'));
 transition(s,b.id,'cancelled',now);assert(slotsForDay(s,'2026-11-06',20,now).some(x=>x.time==='14:00'));
});
test('blocks, pending expiry, weekends and invalid dates are enforced',()=>{
 const s=defaultState();s.blocks.push({id:'block',date:'2026-11-06',start:'14:00',end:'15:00'});
 assert(!slotsForDay(s,'2026-11-06',10,now).some(x=>x.time==='14:00'));
 assert.equal(slotsForDay(s,'2026-11-08',10,now).length,0);
 assert.throws(()=>slotsForDay(s,'2026-02-30',10,now));
 const b=reserve(s,request('15:00'),now,'clientA');b.expiresAt=now-1;
 assert(slotsForDay(s,'2026-11-06',20,now).some(x=>x.time==='15:00'));
});
test('idempotent retries return same booking; request reuse does not leak data',()=>{
 const s=defaultState(),r=request(); const b=reserve(s,r,now,'clientA');
 assert.equal(reserve(s,r,now,'clientA').id,b.id);assert.equal(s.bookings.length,1);
 assert.throws(()=>reserve(s,{...r,name:'另一人'},now,'clientB'),/重複/);
});
test('malformed inputs, no consent, out-of-horizon and contact abuse rejected',()=>{
 const s=defaultState();assert.throws(()=>reserve(s,{...request(),consent:false},now,'A'));
 assert.throws(()=>reserve(s,{...request(),name:' '},now,'A'));
 assert.throws(()=>reserve(s,{...request(),date:'2027-01-01'},now,'A'));
 assert.throws(()=>reserve(s,{...request(),duration:'20'},now,'A'));
 assert.throws(()=>validateConfig({...s.config,bufferMinutes:-1}));
 assert.throws(()=>validateConfig({...s.config,weekly:{...s.config.weekly,1:[{start:'18:00',end:'14:00'}]}}));
});
test('timer state is schedule-based and cannot skip cancellation into active',()=>{
 const s=defaultState();const b=reserve(s,request(),now,'A');
 assert.throws(()=>transition(s,b.id,'active',now));
 transition(s,b.id,'confirmed',now);transition(s,b.id,'active',b.startAt);
 assert.equal(b.endAt-b.startAt,20*60000);transition(s,b.id,'completed',b.endAt);
 assert.throws(()=>transition(s,b.id,'confirmed',now));
});

test('cannot start next session early and consume previous buffer',()=>{
 const s=defaultState(),b1=reserve(s,request('14:00',20),now,'A'),b2=reserve(s,request('14:30',20),now,'B');
 transition(s,b1.id,'confirmed',now);transition(s,b2.id,'confirmed',now);
 transition(s,b1.id,'active',b1.startAt);transition(s,b1.id,'completed',b1.endAt);
 assert.throws(()=>transition(s,b2.id,'active',b1.endAt),/開始時間/);
 transition(s,b2.id,'active',b2.startAt);assert.equal(b2.status,'active');
});
test('live streaming 20-22 is blocked and 23:00 is the final start',()=>{
 const s=defaultState();const slots=slotsForDay(s,'2026-11-06',10,now);
 assert(!slots.some(x=>x.time>='20:00'&&x.time<'22:00'));
 assert(slots.some(x=>x.time==='22:00'));assert(slots.some(x=>x.time==='23:00'));
 assert(!slots.some(x=>x.time>'23:00'));
 const b=reserve(s,request('23:00',30),now,'night');assert(b.busyEndAt<=Date.parse('2026-11-07T00:00:00+08:00'));
});
