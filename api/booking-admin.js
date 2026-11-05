const {queueNotification,dispatchNotification}=require('../server/booking-line');
const store=require('../server/booking-store');
const {validateConfig,transition,addBlock,archiveBooking,maxDurationFor,setReturning,fail}=require('../server/scheduling');
const {send,body,origin,equal,secret,cookie,authenticated,client,handleError}=require('../server/booking-api');
module.exports=async(req,res)=>{try{
 if(req.method==='POST'){
  origin(req);const input=await body(req);
  if(input.action==='login'){
   const key='login-'+client(req),now=Date.now();
   const allowed=await store.mutate(s=>{s.rate=(s.rate||[]).filter(x=>x.at>now-3600000);if(s.rate.filter(x=>x.client===key&&x.at>now-900000).length>=8)return false;s.rate.push({client:key,at:now});return true;});
   if(!allowed)fail('登入次數較多，請15分鐘後再試',429);
   if(typeof input.password!=='string'||!equal(input.password,secret()))fail('管理密碼不正確',401);
   cookie(res);return send(res,200,{ok:true});
  }
  if(!authenticated(req))fail('請先登入預約管理',401);
  if(input.action==='logout'){res.setHeader('Set-Cookie','booking_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
  if(input.action==='line-health'){
   if(!process.env.LINE_CHANNEL_ACCESS_TOKEN)return send(res,200,{ok:true,lineReady:false,reason:'not_configured'});
   try{const r=await fetch('https://api.line.me/v2/bot/info',{headers:{Authorization:'Bearer '+process.env.LINE_CHANNEL_ACCESS_TOKEN},signal:AbortSignal.timeout(8000)});const d=r.ok?await r.json():{};if(!r.ok||d.basicId!=='@740ihcar')return send(res,200,{ok:true,lineReady:false,reason:r.ok?'wrong_official_account':'line_http_'+r.status});const v=await fetch('https://api.line.me/v2/bot/message/validate/push',{method:'POST',headers:{Authorization:'Bearer '+process.env.LINE_CHANNEL_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({messages:[{type:'text',text:'預約通知連線檢查（僅驗證格式，不傳送）'}]}),signal:AbortSignal.timeout(8000)});return send(res,200,{ok:true,lineReady:v.ok,reason:v.ok?'ready':'line_validate_http_'+v.status});}catch{return send(res,200,{ok:true,lineReady:false,reason:'network_unknown'});}
  }
  const result=await store.mutate(s=>{
   if(input.action==='config'){if(input.version!==s.version)fail('其他裝置已更新，請重新整理後再儲存',409);s.config=validateConfig(input.config);return {saved:true};}
   if(input.action==='status'){const b=transition(s,input.id,input.status);queueNotification(b);return {id:b.id,status:b.status};}
   if(input.action==='retry-notification'){const b=s.bookings.find(x=>x.id===input.id);if(!b?.notification||b.notification.forStatus!==b.status)fail('沒有可重送的通知',409);return {id:b.id,status:b.status};}
   if(input.action==='returning')return setReturning(s,input.id,input.allowed);
   if(input.action==='archive'){if(typeof input.archived!=='boolean')fail('移除設定不正確');return archiveBooking(s,input.id,input.archived);}
   if(input.action==='block')return addBlock(s,input);
   if(input.action==='unblock'){if(!s.blocks.some(b=>b.id===input.id))fail('封鎖已移除',404);s.blocks=s.blocks.filter(b=>b.id!==input.id);return {saved:true};}
   fail('操作不正確');
  });let notificationDeferred=false;if(['status','retry-notification'].includes(input.action)){try{await dispatchNotification(store,result.id);}catch{notificationDeferred=true;}}return send(res,200,{ok:true,result,notificationDeferred});
 }
 if(req.method==='GET'){
  if(!authenticated(req))fail('請先登入預約管理',401);
  const {state}=await store.read();
  return send(res,200,{ok:true,lineNotificationsConfigured:Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),rosterUrl:process.env.BOOKING_GOOGLE_SHEET_URL||null,version:state.version,serverNow:Date.now(),config:state.config,blocks:state.blocks,bookings:state.bookings.map(({fingerprint,requestId,...b})=>({...b,returningAllowed:maxDurationFor(state,b.lineIdentity)>30,notification:b.notification?(({text,owner,...n})=>n)(b.notification):null,status:b.status==='pending'&&b.expiresAt<=Date.now()?'expired':b.status}))});
 }
 res.setHeader('Allow','GET, POST');send(res,405,{ok:false,error:'不支援的操作'});
 }catch(e){handleError(res,e);}};
