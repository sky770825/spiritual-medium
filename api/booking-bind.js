const store=require('../server/booking-store');
const {verifyIdentity,queueNotification,dispatchNotification}=require('../server/booking-line');
const {checkBinding,bindIdentity}=require('../server/line-binding');
const {send,body,origin,handleError}=require('../server/booking-api');
module.exports=async(req,res)=>{try{
 if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{ok:false,error:'請透過補綁頁面操作'});}
 origin(req);const input=await body(req);
 const {state}=await store.read();checkBinding(state,input.id,input.token);
 const identity=await verifyIdentity(input);
 const result=await store.mutate(s=>{
  const bound=bindIdentity(s,input.id,input.token,identity),b=s.bookings.find(x=>x.id===bound.id);
  if(!bound.alreadyBound&&b.status==='confirmed')queueNotification(b);
  return {...bound,status:b.status,date:b.date,time:b.time};
 });
 let notificationDeferred=false;
 if(result.status==='confirmed'){try{await dispatchNotification(store,result.id);}catch{notificationDeferred=true;}}
 return send(res,200,{ok:true,...result,notificationDeferred});
 }catch(e){handleError(res,e);}};
