const test=require('node:test'),assert=require('node:assert/strict');
const {issueBinding,checkBinding,bindIdentity}=require('../server/line-binding');
const uid='U'+'a'.repeat(32),other='U'+'b'.repeat(32),now=100000;
const fixture=()=>({bookings:[{id:'booking',status:'pending',startAt:now+1000000,expiresAt:now+500000}]});
test('teacher-issued binding tokens are hashed, expire, and are replaced on regeneration',()=>{
 const s=fixture(),a=issueBinding(s,'booking',now);
 assert.equal(a.token.length,43);assert.ok(!JSON.stringify(s).includes(a.token));
 assert.equal(checkBinding(s,'booking',a.token,now).id,'booking');
 assert.throws(()=>checkBinding(s,'booking','wrong',now),/失效/);
 assert.throws(()=>checkBinding(s,'booking',a.token,a.expiresAt),/失效/);
 const b=issueBinding(s,'booking',now);assert.notEqual(a.token,b.token);assert.throws(()=>checkBinding(s,'booking',a.token,now),/失效/);
});
test('binding requires verified consent, is idempotent for same account and cannot replace another account',()=>{
 const s=fixture(),a=issueBinding(s,'booking',now);
 assert.throws(()=>bindIdentity(s,'booking',a.token,null,now),/登入/);
 const identity={userId:uid,verifiedAt:now,consentedAt:now};
 assert.equal(bindIdentity(s,'booking',a.token,identity,now).alreadyBound,false);
 assert.equal(s.bookings[0].lineIdentity.userId,uid);
 assert.equal(bindIdentity(s,'booking',a.token,identity,now).alreadyBound,true);
 assert.throws(()=>bindIdentity(s,'booking',a.token,{...identity,userId:other},now),/其他LINE/);
 assert.throws(()=>issueBinding(s,'booking',now),/已綁定/);
});
test('cancelled, expired, archived, or already started bookings cannot receive a binding link',()=>{
 for(const patch of [{status:'cancelled'},{status:'completed'},{expiresAt:now},{archivedAt:1},{startAt:now}]){
  const s=fixture();Object.assign(s.bookings[0],patch);assert.throws(()=>issueBinding(s,'booking',now));
 }
});
