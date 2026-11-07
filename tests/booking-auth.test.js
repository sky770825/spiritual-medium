const test=require('node:test'),assert=require('node:assert/strict'),{createHmac}=require('node:crypto');
const api=require('../server/booking-api');
test('admin sessions use an independent signing key and reject password bearer and forged cookies',()=>{
 const old=process.env.BOOKING_SESSION_SECRET,password=process.env.BOOKING_ADMIN_PASSWORD;
 process.env.BOOKING_SESSION_SECRET='independent-random-test-secret-at-least-32-bytes';process.env.BOOKING_ADMIN_PASSWORD='test-admin';
 const req=cookie=>({headers:{cookie}});
 try{
  assert.equal(api.authenticated({headers:{authorization:'Bearer test-admin'}}),false);
  const payload=Buffer.from(JSON.stringify({scope:'booking-admin',exp:Date.now()+60000})).toString('base64url');
  const forged=createHmac('sha256','test-admin').update(payload).digest('base64url');
  assert.equal(api.authenticated(req(`booking_admin=${payload}.${forged}`)),false);
  let value;api.cookie({setHeader(k,v){value=v;}});
  assert.match(value,/HttpOnly; Secure; SameSite=Strict/);
  assert.equal(api.authenticated(req(value)),true);
  assert.equal(api.authenticated(req(value.split(';')[0]+'.extra')),false);
  for(const exp of [Date.now()-1,Date.now()+9*3600000,'9999999999999']){
   const p=Buffer.from(JSON.stringify({scope:'booking-admin',exp})).toString('base64url'),sig=createHmac('sha256',process.env.BOOKING_SESSION_SECRET).update(p).digest('base64url');
   assert.equal(api.authenticated(req(`booking_admin=${p}.${sig}`)),false);
  }
  delete process.env.BOOKING_SESSION_SECRET;assert.throws(()=>api.cookie({setHeader(){}}));
 }finally{for(const [k,v] of [['BOOKING_SESSION_SECRET',old],['BOOKING_ADMIN_PASSWORD',password]])if(v===undefined)delete process.env[k];else process.env[k]=v;}
});

test('request limits also cover parsed JSON and reject non-object bodies',async()=>{
 for(const body of [null,[],123,'null','[]'])await assert.rejects(api.body({headers:{},body}),e=>e.status===400);
 await assert.rejects(api.body({headers:{},body:{name:'字'.repeat(5000)}}),e=>e.status===413);
 assert.deepEqual(await api.body({headers:{},body:{action:'login'}}),{action:'login'});
});
