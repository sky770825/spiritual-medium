function adminCookie(){let value;require('../server/booking-api').cookie({setHeader(k,v){value=v;}});return value.split(';')[0];}
const test=require('node:test'),assert=require('node:assert/strict');
const {defaultState,dateString,slotsForDay,reserve}=require('../server/scheduling');
const {randomUUID}=require('node:crypto');
test('API blocks unbound new requests; teacher can issue a private link and owner can bind once with a real verified identity',async()=>{
 const store=require('../server/booking-store'),saved={read:store.read,mutate:store.mutate,fetch:global.fetch,session:process.env.BOOKING_SESSION_SECRET,password:process.env.BOOKING_ADMIN_PASSWORD,token:process.env.LINE_CHANNEL_ACCESS_TOKEN};
 let state=defaultState(),tail=Promise.resolve(),pushes=0,verifications=0;
 store.read=async()=>({state:structuredClone(state)});store.mutate=fn=>{const p=tail.then(()=>{const copy=structuredClone(state),result=fn(copy);copy.version++;state=copy;return structuredClone(result);});tail=p.catch(()=>{});return p;};
 process.env.BOOKING_SESSION_SECRET='test-session-secret-with-at-least-32-bytes';process.env.BOOKING_ADMIN_PASSWORD='test-admin';process.env.LINE_CHANNEL_ACCESS_TOKEN='test-bot';
 const uid='U'+'d'.repeat(32);
 global.fetch=async(url,options)=>{
  if(url.includes('/verify')){verifications++;const token=new URLSearchParams(options.body).get('id_token');return {ok:token!=='invalid',json:async()=>({iss:'https://access.line.me',aud:'2012387050',sub:token==='other'?'U'+'e'.repeat(32):uid,exp:Date.now()/1000+300})};}
  pushes++;return {ok:true,status:200,headers:new Headers()};
 };
 const admin=require('../api/booking-admin'),binding=require('../api/booking-bind'),booking=require('../api/booking');
 async function call(handler,input,authed=false){let data;const req={method:input?'POST':'GET',url:'/api/test',headers:{host:'test.local',origin:'https://test.local',...(authed?{cookie:adminCookie()}:{})},body:input};const res={setHeader(){},end(x){data=JSON.parse(x);}};await handler(req,res);return {status:res.statusCode,data};}
 try{
  let date,slot;for(let i=1;i<=7;i++){date=dateString(Date.now()+i*86400000);slot=slotsForDay(state,date,10)[0];if(slot)break;}
  const input={name:'Legacy Test',contact:'Legacy',signature:'Legacy Test',question:'PRIVATE',consent:true,requestId:randomUUID(),date,time:slot.time,duration:10};
  assert.equal((await call(booking,input)).status,401);assert.equal(state.bookings.length,0);
  const legacy=reserve(state,input);legacy.status='confirmed';const id=legacy.id;
  assert.equal((await call(admin,{action:'binding-link',id})).status,401);
  const first=(await call(admin,{action:'binding-link',id},true)).data.result;
  const link=(await call(admin,{action:'binding-link',id},true)).data.result;
  assert.notEqual(first.token,link.token);
  const view=await call(admin,null,true);assert.ok(!JSON.stringify(view).includes(link.token));assert.equal(view.data.bookings[0].lineBinding,undefined);
  assert.equal((await call(binding,{id,token:first.token,lineConsent:true,lineIdToken:'valid'})).status,403);assert.equal(verifications,0);
  assert.equal((await call(binding,{id,token:link.token})).status,401);
  assert.equal((await call(binding,{id,token:link.token,lineConsent:true,lineIdToken:'invalid'})).status,401);
  assert.equal(state.bookings[0].lineIdentity,undefined);
  const valid={id,token:link.token,lineConsent:true,lineIdToken:'valid',userId:'attacker'};
  const bound=await call(binding,valid);assert.equal(bound.status,200);assert.equal(state.bookings[0].lineIdentity.userId,uid);assert.equal(pushes,1);assert.equal(state.bookings[0].notification.state,'accepted');
  assert.equal((await call(binding,valid)).status,200);assert.equal(pushes,1);
  assert.equal((await call(binding,{...valid,lineIdToken:'other'})).status,409);assert.equal(state.bookings[0].lineIdentity.userId,uid);
  assert.equal((await call(admin,{action:'binding-link',id},true)).status,409);
  assert.equal((await call(binding,null)).status,405);
 }finally{store.read=saved.read;store.mutate=saved.mutate;global.fetch=saved.fetch;for(const [key,value] of [['BOOKING_SESSION_SECRET',saved.session],['BOOKING_ADMIN_PASSWORD',saved.password],['LINE_CHANNEL_ACCESS_TOKEN',saved.token]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
