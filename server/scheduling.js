const {randomUUID,createHash}=require('node:crypto');
const DAY=86400000;
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
function dateString(ms){return new Date(ms+8*3600000).toISOString().slice(0,10);}
function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||(!Number.isFinite(Date.parse(s+'T00:00:00+08:00'))||dateString(Date.parse(s+'T00:00:00+08:00'))!==s))fail('日期格式不正確');return s;}
function mins(s){if(typeof s!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))fail('時間格式不正確');return Number(s.slice(0,2))*60+Number(s.slice(3));}
function timeString(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
function epoch(date,time){validDate(date);mins(time);return Date.parse(date+'T'+time+':00+08:00');}
function defaultState(){const weekly={0:[]};for(let i=1;i<7;i++)weekly[i]=[{start:'14:00',end:'18:00'},{start:'19:00',end:'21:00'}];return {version:1,config:{enabled:true,weekly,bufferMinutes:10,leadMinutes:60,horizonDays:28},bookings:[],blocks:[],rate:[]};}
function validateConfig(c){if(!c||typeof c.enabled!=='boolean'||!Number.isInteger(c.bufferMinutes)||c.bufferMinutes<5||c.bufferMinutes>60||!Number.isInteger(c.leadMinutes)||c.leadMinutes<30||c.leadMinutes>10080||!Number.isInteger(c.horizonDays)||c.horizonDays<1||c.horizonDays>60)fail('排程設定不正確');const weekly={};for(let i=0;i<7;i++){const windows=c.weekly?.[i];if(!Array.isArray(windows)||windows.length>3)fail('每日最多三段開放時間');let last=-1;weekly[i]=windows.map(w=>{const a=mins(w.start),b=mins(w.end);if(a>=b||a<last)fail('開放時間需依序排列且不可重疊');last=b;return {start:w.start,end:w.end};});}return {enabled:c.enabled,weekly,bufferMinutes:c.bufferMinutes,leadMinutes:c.leadMinutes,horizonDays:c.horizonDays};}
function occupying(b,now){return ['confirmed','active','completed'].includes(b.status)||(b.status==='pending'&&b.expiresAt>now);}
function overlaps(a,b,c,d){return a<d&&b>c;}
function slotsForDay(s,date,duration,now=Date.now()){
 validDate(date);if(![10,20,30].includes(duration))fail('請選擇10、20或30分鐘');
 const today=dateString(now),last=dateString(now+(s.config.horizonDays-1)*DAY);
 if(!s.config.enabled||date<today||date>last)return [];
 const weekday=new Date(date+'T12:00:00+08:00').getUTCDay();
 const busy=s.bookings.filter(b=>b.date===date&&occupying(b,now)).map(b=>[b.startAt,b.busyEndAt]);
 for(const b of s.blocks.filter(b=>b.date===date))busy.push([epoch(date,b.start),epoch(date,b.end)]);
 const result=[];
 for(const w of s.config.weekly[weekday]||[]){for(let m=mins(w.start);m+duration+s.config.bufferMinutes<=mins(w.end);m+=10){
  const startAt=epoch(date,timeString(m)),endAt=startAt+duration*60000,busyEndAt=endAt+s.config.bufferMinutes*60000;
  if(startAt<now+s.config.leadMinutes*60000||busy.some(([a,b])=>overlaps(startAt,busyEndAt,a,b)))continue;
  result.push({time:timeString(m),end:timeString(m+duration),startAt,endAt,busyEndAt});
 }}return result;
}
function clean(value,label,max,required=true){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(label+'不正確');return value.trim();}
function reserve(s,r,now=Date.now(),client='unknown'){
 if(!r||r.consent!==true)fail('請閱讀並同意服務說明');
 const name=clean(r.name,'姓名',40),contact=clean(r.contact,'LINE聯絡名稱',80),signature=clean(r.signature,'簽名',40),question=clean(r.question??'','問題內容',500,false);
 if(!/^[0-9a-f-]{36}$/i.test(r.requestId||''))fail('請重新載入預約頁');
 const fingerprint=createHash('sha256').update(JSON.stringify({name,contact,signature,question,date:r.date,time:r.time,duration:r.duration})).digest('hex');
 const existing=s.bookings.find(b=>b.requestId===r.requestId);
 if(existing){if(existing.fingerprint!==fingerprint)fail('重複請求內容不一致',409);return existing;}
 if(![10,20,30].includes(r.duration))fail('服務時間不正確');
 const slot=slotsForDay(s,r.date,r.duration,now).find(x=>x.time===r.time);if(!slot)fail('這個時段已被預約或未開放，請重新選擇',409);
 s.rate=(s.rate||[]).filter(x=>x.at>now-3600000);
 if(s.rate.filter(x=>x.client===client).length>=5)fail('預約申請較頻繁，請稍後再試或聯絡LINE',429);
 const active=s.bookings.filter(b=>b.contact===contact&&b.startAt>now&&occupying(b,now));if(active.length>=2)fail('已有兩筆未來預約，請先透過LINE確認',429);
 const booking={id:randomUUID(),requestId:r.requestId,fingerprint,name,contact,signature,question,date:r.date,time:r.time,duration:r.duration,price:r.duration/10*300,...slot,status:'pending',createdAt:now,expiresAt:Math.min(now+24*3600000,slot.startAt),consentVersion:'2026-11-05-v2',signedDate:dateString(now)};
 s.bookings.push(booking);s.rate.push({client,at:now});return booking;
}
function transition(s,id,status,now=Date.now()){
 const b=s.bookings.find(x=>x.id===id);if(!b)fail('找不到預約',404);
 const current=b.status==='pending'&&b.expiresAt<=now?'expired':b.status;
 const allowed={pending:['confirmed','cancelled'],confirmed:['active','cancelled'],active:['completed','cancelled'],completed:[],cancelled:[],expired:[]};
 if(!allowed[current]?.includes(status))fail('此預約狀態已變更，請重新整理',409);
 if(status==='active'&&s.bookings.some(x=>x.status==='active'&&x.id!==id))fail('另一場交流尚未結束',409);
 if(status==='active'&&(now<b.startAt||now>=b.endAt))fail('只能在排定的開始時間至結束前啟動',409);
 b.status=status;b.updatedAt=now;if(status==='active')b.actualStartAt=now;if(status==='completed')b.actualEndAt=now;return b;
}
function addBlock(s,r,now=Date.now()){
 validDate(r.date);const a=epoch(r.date,r.start),b=epoch(r.date,r.end);if(a>=b)fail('封鎖結束時間需晚於開始');
 if(s.bookings.some(x=>x.date===r.date&&occupying(x,now)&&overlaps(a,b,x.startAt,x.busyEndAt)))fail('封鎖時間與現有預約重疊，請先處理預約',409);
 if(s.blocks.some(x=>x.date===r.date&&overlaps(a,b,epoch(x.date,x.start),epoch(x.date,x.end))))fail('封鎖時間重疊',409);
 const block={id:randomUUID(),date:r.date,start:r.start,end:r.end,reason:clean(r.reason??'休息','封鎖原因',80,false)};s.blocks.push(block);return block;
}
module.exports={defaultState,validateConfig,slotsForDay,reserve,transition,addBlock,dateString,epoch,occupying,fail};
