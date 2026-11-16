const store=require('../server/booking-store');
const {verifyIdentity,queueNotification,dispatchNotification}=require('../server/booking-line');
const {owner,available,requestChange,cancelOwn}=require('../server/booking-changes');
const {fail}=require('../server/scheduling');
const {send,body,origin,handleError}=require('../server/booking-api');
function snapshot(b,now){return {id:b.id,date:b.date,time:b.time,startAt:b.startAt,endAt:b.endAt,duration:b.duration,price:b.price,name:b.name,status:b.status==='pending'&&b.expiresAt<=now?'expired':b.status,expiresAt:b.expiresAt,reschedule:b.reschedule||null};}
module.exports=async(req,res)=>{try{
 if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{ok:false,error:'請登入LINE後操作'});}
 origin(req);const input=await body(req),identity=await verifyIdentity(input);if(!identity)fail('請先登入LINE並同意身分驗證',401);
 if(input.action==='list'||input.action==='slots'){const {state}=await store.read(),now=Date.now();if(input.action==='list')return send(res,200,{ok:true,serverNow:now,bookings:state.bookings.filter(b=>!b.archivedAt&&b.lineIdentity?.userId===identity.userId).sort((a,b)=>b.startAt-a.startAt).map(b=>snapshot(b,now))});const b=owner(state,input.id,identity,now);return send(res,200,{ok:true,slots:available(state,b,input.date,now)});}
 const result=await store.mutate(s=>{const now=Date.now(),b=owner(s,input.id,identity,now);if(input.action==='cancel'){cancelOwn(s,b,now);if(b.reschedule?.state==='pending')b.reschedule.state='cancelled';queueNotification(b);}else if(input.action==='reschedule')requestChange(s,b,input,now);else fail('操作不正確');return snapshot(b,now);});
 let notificationDeferred=false;if(input.action==='cancel')try{await dispatchNotification(store,result.id);}catch{notificationDeferred=true;}
 return send(res,200,{ok:true,booking:result,notificationDeferred});
 }catch(e){handleError(res,e);}};
