const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {fail}=require('./scheduling');
const hash=token=>createHash('sha256').update(token).digest('hex');
function eligible(state,id,now){
 const b=state.bookings.find(x=>x.id===id);
 if(!b||b.archivedAt||!['pending','confirmed'].includes(b.status)||!Number.isFinite(b.startAt)||b.startAt<=now||b.status==='pending'&&(!Number.isFinite(b.expiresAt)||b.expiresAt<=now))fail('補綁連結已失效，請聯繫老師重新確認預約',403);
 return b;
}
function issueBinding(state,id,now=Date.now()){
 const b=eligible(state,id,now);if(b.lineIdentity?.userId)fail('此預約已綁定LINE帳號，不能產生更換帳號連結',409);
 const token=randomBytes(32).toString('base64url');
 const expiresAt=Math.min(now+24*3600000,b.startAt,b.status==='pending'?b.expiresAt:Infinity);
 b.lineBinding={hash:hash(token),expiresAt};return {id:b.id,token,expiresAt};
}
function checkBinding(state,id,token,now=Date.now()){
 const b=eligible(state,id,now),credential=b.lineBinding;
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||!credential||!Number.isFinite(credential.expiresAt)||credential.expiresAt<=now||typeof credential.hash!=='string'||credential.hash.length!==64||!timingSafeEqual(Buffer.from(credential.hash),Buffer.from(hash(token))))fail('補綁連結已失效，請聯繫老師重新產生連結',403);
 return b;
}
function bindIdentity(state,id,token,identity,now=Date.now()){
 if(!/^U[0-9a-f]{32}$/i.test(identity?.userId||'')||!identity?.consentedAt||!identity?.verifiedAt)fail('請登入LINE並同意綁定預約',401);
 const b=checkBinding(state,id,token,now);
 if(b.lineIdentity?.userId){if(b.lineIdentity.userId!==identity.userId)fail('此預約已綁定其他LINE帳號，請聯繫老師',409);return {id:b.id,alreadyBound:true};}
 b.lineIdentity=identity;b.lineBinding.usedAt=now;b.updatedAt=now;return {id:b.id,alreadyBound:false};
}
module.exports={issueBinding,checkBinding,bindIdentity};
