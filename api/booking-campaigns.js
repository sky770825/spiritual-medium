const store=require('../server/audience-store'),bookingStore=require('../server/booking-store');
const {send,body,origin,authenticated,handleError}=require('../server/booking-api');
const {fail}=require('../server/scheduling');
const {choose,customers,publicCustomer,setProfile}=require('../server/customer-audience');
const {audience,createDraft,summary,line,quota,dispatch,flex}=require('../server/audience');
module.exports=async(req,res)=>{try{
 if(!authenticated(req))fail('請先登入預約管理',401);
 if(req.method==='GET'){const {state}=await store.read();const {state:bookings}=await bookingStore.read();const seen=new Set();const candidates=bookings.bookings.filter(b=>!b.archivedAt&&b.lineIdentity?.consentedAt&&b.lineIdentity?.userId&&!seen.has(b.lineIdentity.userId)&&seen.add(b.lineIdentity.userId)).map(b=>({id:b.id,name:b.name}));return send(res,200,{ok:true,trackingStartedAt:state.trackingStartedAt,knownJoinDates:state.friends.filter(f=>f.joinedAt&&!f.blocked).length,unknownJoinDates:state.friends.filter(f=>!f.joinedAt&&!f.blocked).length,testCandidates:candidates,customers:customers(bookings,state).map(publicCustomer),campaigns:state.campaigns.filter(c=>c.status!=='draft').slice(-50).reverse().map(summary)});}
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return send(res,405,{ok:false});}
 origin(req);const input=await body(req);
 if(input.action==='audience'){const {state}=await store.read(),{state:bookingState}=await bookingStore.read(),picked=choose(state,bookingState,input);return send(res,200,{ok:true,count:picked.recipients.length,stats:picked.stats,selection:picked.selection,trackingStartedAt:state.trackingStartedAt});}
 if(input.action==='customer-profile'){const {state:bookingState}=await bookingStore.read();const result=await store.mutate(s=>setProfile(s,bookingState,input));return send(res,200,{ok:true,result});}
 if(input.action==='validate'){const r=await line('/message/validate/multicast',{method:'POST',body:{messages:[flex(input)]}});if(!r.ok)fail('LINE訊息格式驗證未通過',400);return send(res,200,{ok:true,valid:true});}
 if(input.action==='quota')return send(res,200,{ok:true,quota:await quota()});
 if(input.action==='connection'){const r=await line('/channel/webhook/endpoint');if(!r.ok)fail('無法讀取好友事件連線',503);const d=await r.json();const connected=d.active===true&&d.endpoint==='https://spiritual-medium-site.vercel.app/api/line/audience-webhook';let signatureVerified=false,webhookStatus=null;if(connected&&input.verify===true){const t=await line('/channel/webhook/test',{method:'POST',body:{endpoint:'https://spiritual-medium-site.vercel.app/api/line/audience-webhook'}});if(t.ok){const result=await t.json();signatureVerified=result.success===true;webhookStatus=result.statusCode??null;}}return send(res,200,{ok:true,trackingConnected:connected,hasSecret:Boolean(process.env.LINE_CHANNEL_SECRET),signatureVerified,webhookStatus});}
 if(input.action==='preview'){let testUserId;const {state:bookingState}=await bookingStore.read();if(input.test===true){const b=bookingState.bookings.find(b=>b.id===input.testBookingId&&!b.archivedAt&&b.lineIdentity?.consentedAt);testUserId=b?.lineIdentity?.userId;}const draft=await store.mutate(s=>createDraft(s,input,{testUserId,bookingState}));return send(res,200,{ok:true,draft});}
 if(input.action==='send'){if(input.confirmed!==true)fail('請先確認收件範圍與內容');await dispatch(store,input.id,{getBookingState:async()=>(await bookingStore.read()).state});const {state}=await store.read();return send(res,200,{ok:true,campaign:summary(state.campaigns.find(c=>c.id===input.id))});}
 fail('操作不正確');
 }catch(e){handleError(res,e);}};
