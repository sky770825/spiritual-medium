const {verifyIdentity}=require('../server/booking-line');
const store=require('../server/booking-store');
const {dateString,slotsForDay,reserve,maxDurationFor,fail}=require('../server/scheduling');
const {send,body,origin,client,handleError}=require('../server/booking-api');
module.exports=async(req,res)=>{try{
 const now=Date.now();
 if(req.method==='GET'){
  const url=new URL(req.url,'https://local'),duration=Number(url.searchParams.get('duration')||10);
  if(![10,20,30,40,50,60].includes(duration))fail('服務時間不正確');
  const {state}=await store.read();const days=[];
  for(let i=0;i<state.config.horizonDays;i++){const date=dateString(now+i*86400000);days.push({date,slots:slotsForDay(state,date,duration,now)});}
  return send(res,200,{ok:true,timezone:'Asia/Taipei',serverNow:now,bufferMinutes:state.config.bufferMinutes,leadMinutes:state.config.leadMinutes,horizonDays:state.config.horizonDays,enabled:state.config.enabled,days});
 }
 if(req.method==='POST'){
  origin(req);const input=await body(req);if(input.website)fail('無法接受此預約');
  const identity=await verifyIdentity(input);
  if(!identity)fail('請先登入LINE並勾選身分綁定，再送出預約；若無法登入請透過官方LINE人工預約',401);
  if(input.action==='eligibility'){if(!identity)fail('請先登入LINE並勾選身分綁定',401);const {state}=await store.read();return send(res,200,{ok:true,maxDuration:maxDurationFor(state,identity),returning:maxDurationFor(state,identity)>30});}
  const booking=await store.mutate(s=>reserve(s,input,Date.now(),client(req),identity));
  return send(res,201,{ok:true,booking:{id:booking.id,date:booking.date,time:booking.time,endAt:booking.endAt,startAt:booking.startAt,duration:booking.duration,price:booking.price,status:booking.status==='pending'&&booking.expiresAt<Date.now()?'expired':booking.status,lineBound:Boolean(booking.lineIdentity),expiresAt:booking.expiresAt}});
 }
 res.setHeader('Allow','GET, POST');return send(res,405,{ok:false,error:'不支援的操作'});
 }catch(e){handleError(res,e);}};
