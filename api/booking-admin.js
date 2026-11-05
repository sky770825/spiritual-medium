const store=require('../server/booking-store');
const {validateConfig,transition,addBlock,fail}=require('../server/scheduling');
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
  const result=await store.mutate(s=>{
   if(input.action==='config'){if(input.version!==s.version)fail('其他裝置已更新，請重新整理後再儲存',409);s.config=validateConfig(input.config);return {saved:true};}
   if(input.action==='status'){const b=transition(s,input.id,input.status);return {id:b.id,status:b.status};}
   if(input.action==='block')return addBlock(s,input);
   if(input.action==='unblock'){if(!s.blocks.some(b=>b.id===input.id))fail('封鎖已移除',404);s.blocks=s.blocks.filter(b=>b.id!==input.id);return {saved:true};}
   fail('操作不正確');
  });return send(res,200,{ok:true,result});
 }
 if(req.method==='GET'){
  if(!authenticated(req))fail('請先登入預約管理',401);
  const {state}=await store.read();
  return send(res,200,{ok:true,version:state.version,serverNow:Date.now(),config:state.config,blocks:state.blocks,bookings:state.bookings.map(({fingerprint,requestId,...b})=>({...b,status:b.status==='pending'&&b.expiresAt<=Date.now()?'expired':b.status}))});
 }
 res.setHeader('Allow','GET, POST');send(res,405,{ok:false,error:'不支援的操作'});
 }catch(e){handleError(res,e);}};
