const {randomUUID,createHash}=require('node:crypto');
const {fail,dateString}=require('./scheduling');
const uid=value=>typeof value==='string'&&/^U[0-9a-f]{32}$/i.test(value);
function recordEvents(s,events,now=Date.now()){
 if(!Array.isArray(events)||events.length>1000)fail('Invalid events');
 s.trackingStartedAt=s.trackingStartedAt||now;
 for(const e of events){if(!['follow','unfollow'].includes(e.type)||e.source?.type!=='user'||!uid(e.source.userId)||!Number.isFinite(e.timestamp)||e.timestamp<=0||e.timestamp>now+300000)continue;
  let f=s.friends.find(x=>x.userId===e.source.userId);if(!f){if(s.friends.length>=20000)fail('受眾紀錄已達上限',503);f={userId:e.source.userId,joinedAt:null,lastEventAt:0,blocked:false};s.friends.push(f);}
  // Only an explicit add-friend event provides an observed join date. Unblocks never create one.
  if(e.type==='follow'&&e.follow?.isUnblocked===false&&(!f.joinedAt||e.timestamp<f.joinedAt))f.joinedAt=e.timestamp;
  if(e.timestamp>f.lastEventAt||e.timestamp===f.lastEventAt&&e.type==='unfollow'){f.blocked=e.type==='unfollow';f.lastEventAt=e.timestamp;}
 }
}
function cutoff(value,now=Date.now()){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('請選擇加入好友的起始日期');const n=Date.parse(value+'T00:00:00+08:00');if(!Number.isFinite(n)||dateString(n)!==value||n>now)fail('加入日期不正確');return n;}
function audience(s,since,now=Date.now()){const from=cutoff(since,now);return [...new Set(s.friends.filter(f=>uid(f.userId)&&Number.isFinite(f.joinedAt)&&f.joinedAt>=from&&f.joinedAt<=now&&!f.blocked).map(f=>f.userId))];}
function flex(input){if(typeof input.title!=='string'||!input.title.trim()||input.title.length>60||typeof input.text!=='string'||!input.text.trim()||input.text.length>1500||typeof input.bookingButton!=='boolean')fail('標題限60字，內容限1500字');const title=input.title.trim(),text=input.text.trim();return {type:'flex',altText:title,contents:{type:'bubble',size:'mega',header:{type:'box',layout:'vertical',backgroundColor:'#153C42',contents:[{type:'text',text:title,size:'xl',weight:'bold',color:'#FFFFFF',wrap:true}]},body:{type:'box',layout:'vertical',spacing:'md',contents:[{type:'text',text:'宇宙玉皇大帝原始大天尊無上至尊',size:'xs',color:'#777777',wrap:true},{type:'text',text,size:'md',wrap:true,color:'#243549'}]},...(input.bookingButton?{footer:{type:'box',layout:'vertical',contents:[{type:'button',style:'primary',color:'#176654',action:{type:'uri',label:'查看可預約時間',uri:'https://spiritual-medium-site.vercel.app/reserve.html?new=1'}}]}}:{})}};}
function createDraft(s,input,{testUserId,now=Date.now()}={}){
 const message=flex(input),test=input.test===true;if(input.test!==undefined&&typeof input.test!=='boolean')fail('測試設定不正確');
 if(test&&!uid(testUserId))fail('請選擇測試收件人');
 const recipients=test?[testUserId]:audience(s,input.since,now);if(recipients.length>500)fail('本次超過500人，請縮小日期範圍，避免超出單次發送上限');
 const fingerprint=createHash('sha256').update(JSON.stringify({message,recipients:[...recipients].sort(),test})).digest('hex');
 const existing=s.campaigns.find(c=>c.fingerprint===fingerprint&&((c.status==='draft'&&c.createdAt>now-900000)||(c.status!=='draft'&&c.createdAt>now-86400000)));if(existing)return summary(existing);
 const c={fingerprint,id:randomUUID(),key:randomUUID(),status:'draft',test,since:test?null:input.since,title:input.title.trim(),message,recipients,count:recipients.length,createdAt:now,attempts:0};
 s.campaigns=s.campaigns.filter(x=>x.status!=='draft'||x.createdAt>now-86400000);if(s.campaigns.length>=300)fail('發送紀錄已達上限，請聯絡管理者',409);s.campaigns.push(c);return summary(c);
}
function summary(c){const {id,status,test,since,title,count,createdAt,acceptedAt,attempts,error,lastAttemptAt}=c;return {id,status,test,since,title,count,createdAt,acceptedAt,attempts,error,lastAttemptAt};}
async function line(path,{method='GET',body,fetch:request=fetch,token=process.env.LINE_CHANNEL_ACCESS_TOKEN,key}={}){if(!token)fail('LINE發訊授權尚未設定',503);return request('https://api.line.me/v2/bot'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{}),...(key?{'X-Line-Retry-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});}
async function quota(options={}){const results=await Promise.all(['/message/quota','/message/quota/consumption'].map(async p=>{const r=await line(p,options);if(!r.ok)fail('無法查詢LINE額度，暫停發送',503);return r.json();}));const limit=results[0].type==='none'?null:results[0].value,used=results[1].totalUsage;if((limit!==null&&!Number.isFinite(limit))||!Number.isFinite(used))fail('LINE額度資料不完整，暫停發送',503);return {limit,used,remaining:limit===null?null:Math.max(0,limit-used)};}
async function dispatch(store,id,options={}){
 const q=await quota(options),owner=randomUUID(),now=Date.now();
 const claim=await store.mutate(s=>{const c=s.campaigns.find(x=>x.id===id);if(!c)fail('找不到群發預覽',404);if(c.status==='accepted')return null;if(c.status==='sending'&&c.leaseUntil>now)fail('正在發送，請稍後查看紀錄',409);if(c.status==='draft'&&now-c.createdAt>900000)fail('預覽已超過15分鐘，請重新預覽',409);if(c.firstAttemptAt&&now-c.firstAttemptAt>23*3600000)fail('已超過安全重試時間，請人工核對，勿重複群發',409);if(!c.count)fail('目前沒有加入日期符合條件的好友，未發送');if(q.remaining!==null&&c.count>q.remaining)fail(`剩餘額度 ${q.remaining} 則，不足以發送給 ${c.count} 人`,409);
  if(!c.test&&c.recipients.some(id=>s.friends.find(f=>f.userId===id)?.blocked))fail('受眾封鎖狀態已更新，請重新預覽',409);
  c.status='sending';c.owner=owner;c.leaseUntil=now+120000;c.attempts++;c.lastAttemptAt=now;c.firstAttemptAt=c.firstAttemptAt||now;delete c.error;return {key:c.key,recipients:c.recipients,message:c.message};});
 if(!claim)return;
 let result;try{const r=await line('/message/multicast',{...options,method:'POST',body:{to:claim.recipients,messages:[claim.message]},key:claim.key});if(r.ok||r.status===409&&r.headers.get('x-line-accepted-request-id'))result={status:'accepted',acceptedAt:Date.now()};else result={status:'failed',error:r.status===429?'LINE額度或頻率限制，請核對用量後重試':'LINE未受理（HTTP '+r.status+'）'};}catch{result={status:'failed',error:'連線中斷，結果未確認；請使用同一筆紀錄重試，勿重建相同群發'};}
 await store.mutate(s=>{const c=s.campaigns.find(x=>x.id===id);if(c?.key===claim.key&&c.owner===owner){Object.assign(c,result);delete c.owner;delete c.leaseUntil;}return null;});
}
module.exports={recordEvents,audience,flex,createDraft,summary,line,quota,dispatch};
