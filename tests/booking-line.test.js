const test=require('node:test'),assert=require('node:assert/strict');
const {verifyIdentity,queueNotification,dispatchNotification,notificationText}=require('../server/booking-line');
const uid='U'+'a'.repeat(32),channel='2012387050';
const claims=()=>({iss:'https://access.line.me',aud:channel,sub:uid,exp:Math.floor(Date.now()/1000)+60});
const ok=data=>({ok:true,status:200,json:async()=>data,headers:new Headers()});
test('identity comes only from server verified token with explicit consent; rejects wrong audience and expired token',async()=>{
 assert.equal(await verifyIdentity({}, {fetch:()=>{throw Error('must not call')}}),null);
 await assert.rejects(()=>verifyIdentity({lineIdToken:'fake',lineConsent:false}),/同意/);
 const identity=await verifyIdentity({lineIdToken:'token',lineConsent:true,userId:'attacker'},{channelId:channel,fetch:async(url,opts)=>{assert.equal(new URLSearchParams(opts.body).get('client_id'),channel);return ok(claims());}});
 assert.equal(identity.userId,uid);assert.equal(identity.idToken,undefined);
 for(const patch of [{aud:'wrong'},{exp:1},{iss:'evil'},{sub:'attacker'}])await assert.rejects(()=>verifyIdentity({lineIdToken:'token',lineConsent:true},{channelId:channel,fetch:async()=>ok({...claims(),...patch})}));
 await assert.rejects(()=>verifyIdentity({lineIdToken:'token',lineConsent:true},{channelId:channel,fetch:async()=>({ok:false,status:401})}),/重新登入/);
});
function setup(bound=true){const b={id:'test',name:'姓名',date:'2026-11-06',time:'14:00',duration:10,price:300,status:'confirmed',question:'PRIVATE',contact:'PRIVATE',...(bound?{lineIdentity:{userId:uid,consentedAt:1}}:{})};queueNotification(b);const state={bookings:[b]};let tail=Promise.resolve();const store={mutate:fn=>{const p=tail.then(()=>fn(state));tail=p.catch(()=>{});return p;}};return {b,store};}
test('approval queue persists, concurrent sends claim once, accepted never means read, excludes private content',async()=>{
 const {b,store}=setup();let calls=0;const deps={token:'secret',fetch:async(url,opts)=>{calls++;assert.equal(JSON.parse(opts.body).to,uid);assert.equal(opts.headers['X-Line-Retry-Key'],b.notification.key);return ok({});}};
 await Promise.all([dispatchNotification(store,b.id,deps),dispatchNotification(store,b.id,deps)]);assert.equal(calls,1);assert.equal(b.notification.state,'accepted');assert.equal(b.notification.readAt,undefined);assert.ok(!notificationText(b).includes('PRIVATE'));
 await dispatchNotification(store,b.id,deps);assert.equal(calls,1);
});
test('ambiguous network failure retries identical event key; cancellation creates different key',async()=>{
 const {b,store}=setup(),key=b.notification.key;
 await dispatchNotification(store,b.id,{token:'secret',fetch:async()=>{throw Error('secret upstream dump');}});assert.equal(b.notification.state,'failed');assert.ok(!JSON.stringify(b.notification).includes('dump'));
 await dispatchNotification(store,b.id,{token:'secret',fetch:async(url,opts)=>{assert.equal(opts.headers['X-Line-Retry-Key'],key);return {ok:false,status:409,headers:new Headers({'x-line-accepted-request-id':'accepted'})};}});assert.equal(b.notification.state,'accepted');
 b.status='cancelled';queueNotification(b);assert.notEqual(b.notification.key,key);assert.match(notificationText(b),/取消/);
});
test('legacy bookings need manual contact, missing config is visible, stale lease recovers, outdated event does not send',async()=>{
 const legacy=setup(false);await dispatchNotification(legacy.store,'test',{token:'x',fetch:()=>{throw Error('must not send')}});assert.equal(legacy.b.notification.state,'manual');
 const {b,store}=setup();await dispatchNotification(store,'test',{token:''});assert.equal(b.notification.state,'failed');assert.equal(b.notification.error,'not_configured');
 b.notification.state='sending';b.notification.leaseUntil=1;await dispatchNotification(store,'test',{token:'x',fetch:async()=>ok({})});assert.equal(b.notification.state,'accepted');
 queueNotification(b);b.status='cancelled';let called=false;await dispatchNotification(store,'test',{token:'x',fetch:async()=>{called=true;return ok({});}});assert.equal(called,false);
});
const {reserve,defaultState,transition,epoch}=require('../server/scheduling');const {randomUUID}=require('node:crypto');
test('reservation binds only injected verified identity and rejects replay by different identity',()=>{
 const s=defaultState(),now=epoch('2026-11-05','10:00'),r={requestId:randomUUID(),name:'測試',contact:'測試',signature:'測試',question:'',consent:true,date:'2026-11-06',time:'14:00',duration:10,userId:'forged'};
 const b=reserve(s,r,now,'test',{userId:uid,consentedAt:now});assert.equal(b.lineIdentity.userId,uid);assert.equal(b.lineIdToken,undefined);
 assert.equal(reserve(s,r,now,'test',{userId:uid,consentedAt:now}),b);
 assert.throws(()=>reserve(s,r,now,'test',{userId:'U'+'b'.repeat(32),consentedAt:now}),/不一致/);
 assert.throws(()=>reserve(s,r,now,'test'),/不一致/);
 b.notification={state:'sending',leaseUntil:now+10000};assert.throws(()=>transition(s,b.id,'confirmed',now),/通知正在傳送/);
});
test('lifecycle advancement explicitly supersedes unsent approval and disallows stale notification',async()=>{const {b,store}=setup();b.status='active';queueNotification(b);assert.equal(b.notification.state,'superseded');await dispatchNotification(store,b.id,{token:'x',fetch:()=>{throw Error('no stale send');}});});
test('pre-upgrade unbound request can be retried without changing identity or leaking another record',()=>{const {createHash}=require('node:crypto');const s=defaultState(),now=epoch('2026-11-05','10:00'),r={requestId:randomUUID(),name:'old',contact:'old',signature:'old',question:'',consent:true,date:'2026-11-06',time:'14:00',duration:10};const b=reserve(s,r,now);b.fingerprint=createHash('sha256').update(JSON.stringify({name:r.name,contact:r.contact,signature:r.signature,question:r.question,date:r.date,time:r.time,duration:r.duration})).digest('hex');assert.equal(reserve(s,r,now),b);assert.throws(()=>reserve(s,r,now,'x',{userId:uid,consentedAt:now}),/不一致/);});
test('removed records can be restored; active reservations cannot disappear',()=>{const {archiveBooking}=require('../server/scheduling');const s={bookings:[{id:'a',status:'confirmed'},{id:'b',status:'cancelled'}]};assert.throws(()=>archiveBooking(s,'a',true),/取消/);archiveBooking(s,'b',true);assert.ok(s.bookings[1].archivedAt);archiveBooking(s,'b',false);assert.equal(s.bookings[1].archivedAt,undefined);assert.equal(s.bookings.length,2);});
