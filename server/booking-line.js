const {randomUUID}=require('node:crypto');
const {fail}=require('./scheduling');
const CHANNEL_ID='2012387050';
async function verifyIdentity(input,{fetch:request=fetch,channelId=process.env.LINE_LOGIN_CHANNEL_ID||CHANNEL_ID}={}){
 if(!input.lineIdToken){if(input.lineConsent===true)fail('請先登入LINE再綁定預約',401);return null;}
 if(input.lineConsent!==true)fail('請同意LINE身分綁定與預約結果通知');
 if(typeof input.lineIdToken!=='string'||input.lineIdToken.length>6000)fail('LINE登入資料不正確',401);
 let response;try{response=await request('https://api.line.me/oauth2/v2.1/verify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({id_token:input.lineIdToken,client_id:channelId}).toString(),signal:AbortSignal.timeout(8000)});}catch{fail('LINE驗證暫時無法連線，請稍後重試',503);}
 if(!response.ok)fail('LINE身分驗證失敗，請重新登入',401);
 const d=await response.json();if(d.iss!=='https://access.line.me'||String(d.aud)!==channelId||!/^U[0-9a-f]{32}$/i.test(d.sub||'')||!Number.isFinite(d.exp)||d.exp<=Date.now()/1000)fail('LINE身分驗證失敗，請重新登入',401);
 return {userId:d.sub,verifiedAt:Date.now(),consentedAt:Date.now(),consentVersion:'2026-11-05-line-v1',channelId};
}
function notificationText(b){return [`【預約${b.status==='confirmed'?'已核准':'已取消'}】`,'宇宙玉皇大帝原始大天尊無上至尊',`預約編號：${b.id}`,`時間：${b.date} ${b.time}（台北時間）`,`時長：${b.duration}分鐘｜NT$${b.price}`,b.status==='confirmed'?'老師已確認此時段，請準時透過官方LINE聯繫。服務結束後付費。':'此預約已取消，原時段已釋出。如需重新預約，請聯繫官方LINE。'].join('\n');}
function queueNotification(b,now=Date.now()){
 if(!['confirmed','cancelled'].includes(b.status)){if(b.notification&&['queued','failed','sending'].includes(b.notification.state)){b.notification.state='superseded';delete b.notification.owner;delete b.notification.leaseUntil;}return;}
 b.notification={key:randomUUID(),forStatus:b.status,state:b.lineIdentity?.userId&&b.lineIdentity?.consentedAt?'queued':'manual',createdAt:now,attempts:0,text:notificationText(b)};
}
async function dispatchNotification(store,id,{fetch:request=fetch,token=process.env.LINE_CHANNEL_ACCESS_TOKEN}={}){
 const owner=randomUUID(),now=Date.now();
 const claim=await store.mutate(s=>{
  const b=s.bookings.find(x=>x.id===id),n=b?.notification;
  if(!n||n.forStatus!==b.status||['accepted','manual'].includes(n.state)||n.state==='sending'&&n.leaseUntil>now)return null;
  if(!b.lineIdentity?.userId||!b.lineIdentity.consentedAt){n.state='manual';return null;}
  if(now-n.createdAt>23*3600000){n.state='manual';n.error='retry_window_expired';return null;}
  if(!token){n.state='failed';n.error='not_configured';return null;}
  n.state='sending';n.owner=owner;n.leaseUntil=now+120000;n.attempts++;n.lastAttemptAt=now;delete n.error;
  return {to:b.lineIdentity.userId,text:n.text,key:n.key};
 });
 if(!claim)return;
 let result;try{
  const response=await request('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Line-Retry-Key':claim.key},body:JSON.stringify({to:claim.to,messages:[{type:'text',text:claim.text}]}),signal:AbortSignal.timeout(8000)});
  const accepted=response.ok||response.status===409&&Boolean(response.headers.get('x-line-accepted-request-id'));
  result=accepted?{state:'accepted',acceptedAt:Date.now()}:{state:'failed',error:'line_http_'+response.status};
 }catch{result={state:'failed',error:'network_unknown'};}
 await store.mutate(s=>{const n=s.bookings.find(x=>x.id===id)?.notification;if(n?.key===claim.key&&n.owner===owner){Object.assign(n,result);delete n.owner;delete n.leaseUntil;}return null;});
}
module.exports={verifyIdentity,queueNotification,dispatchNotification,notificationText};
