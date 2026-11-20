const {randomUUID}=require('node:crypto');
const {fail,slotsForDay,transition,maxDurationFor}=require('./scheduling');
function editable(s,id,now){const b=s.bookings.find(x=>x.id===id);if(!b||b.archivedAt)fail('找不到預約',404);if(!['pending','confirmed'].includes(b.status)||b.startAt<=now||b.status==='pending'&&b.expiresAt<=now)fail('此預約已開始、到期或結束，請聯絡老師',409);if(b.notification?.state==='sending'&&b.notification.leaseUntil>now)fail('通知正在傳送，請稍後再試',409);return b;}
function owner(s,id,identity,now=Date.now()){const b=s.bookings.find(x=>x.id===id);if(!identity?.userId||b?.lineIdentity?.userId!==identity.userId||!identity.consentedAt)fail('無法存取此預約',403);return editable(s,id,now);}
function available(s,b,date,now=Date.now()){return slotsForDay({...s,bookings:s.bookings.filter(x=>x.id!==b.id)},date,b.duration,now);}
function requestChange(s,b,input,now=Date.now()){
 if(b.reschedule?.state==='pending')fail('已有待審核的改期申請，請等待老師處理',409);
 if(input.date===b.date&&input.time===b.time)fail('請選擇不同的時段');
 const slot=available(s,b,input.date,now).find(x=>x.time===input.time);if(!slot)fail('新時段已不可預約，請重新選擇',409);
 b.reschedule={id:randomUUID(),state:'pending',date:input.date,time:slot.time,startAt:slot.startAt,endAt:slot.endAt,requestedAt:now};b.updatedAt=now;return b;
}
function decideChange(s,input,now=Date.now()){
 const b=editable(s,input.id,now),r=b.reschedule;
 if(!r||r.state!=='pending'||r.id!==input.requestId)fail('改期申請已變更，請重新整理',409);
 if(typeof input.approved!=='boolean')fail('審核資料不正確');
 if(input.approved){const slot=available(s,b,r.date,now).find(x=>x.time===r.time);if(!slot)fail('新時段已被預約或不再開放；原預約保留，請聯絡客戶另選時間',409);b.scheduleHistory=[...(b.scheduleHistory||[]),{date:b.date,time:b.time,startAt:b.startAt,endAt:b.endAt,changedAt:now}].slice(-20);b.date=r.date;Object.assign(b,slot);b.status='confirmed';}
 r.state=input.approved?'approved':'rejected';r.decidedAt=now;b.updatedAt=now;return b;
}
function teacherAvailable(s,b,date,duration=b.duration,now=Date.now()){
 const maximum=Math.max(b.duration,maxDurationFor(s,b.lineIdentity,now));
 if(![10,20,30,40,50,60].includes(duration)||duration>maximum)fail('首次預約最多30分鐘；40至60分鐘需先開放回訪資格',403);
 return slotsForDay({...s,config:{...s.config,leadMinutes:0},bookings:s.bookings.filter(x=>x.id!==b.id)},date,duration,now);
}
function teacherChange(s,input,now=Date.now()){
 const b=editable(s,input.id,now),duration=input.duration===undefined?b.duration:input.duration;
 if(input.updatedAt!==(b.updatedAt||b.createdAt))fail('資料已更新，請重新整理後再更改',409);
 if(b.reschedule?.state==='pending')fail('請先處理客戶的改期申請，再由老師更改時間',409);
 if(input.date===b.date&&input.time===b.time&&duration===b.duration)fail('請更改日期、時間或分鐘數');
 const slot=teacherAvailable(s,b,input.date,duration,now).find(x=>x.time===input.time);
 if(!slot)fail('此時段無法容納所選分鐘數與緩衝，可能與下一筆預約或休息重疊；原預約保留，請另選時間',409);
 b.scheduleHistory=[...(b.scheduleHistory||[]),{date:b.date,time:b.time,startAt:b.startAt,endAt:b.endAt,busyEndAt:b.busyEndAt,duration:b.duration,price:b.price,changedAt:now}].slice(-20);
 b.date=input.date;Object.assign(b,slot);b.duration=duration;b.price=duration*30;b.status='confirmed';
 b.reschedule={id:randomUUID(),state:'approved',source:'teacher',date:b.date,time:b.time,startAt:b.startAt,endAt:b.endAt,duration,price:b.price,requestedAt:now,decidedAt:now};b.updatedAt=now;return b;
}
function cancelOwn(s,b,now=Date.now()){return transition(s,b.id,'cancelled',now);}
module.exports={teacherAvailable,teacherChange,editable,owner,available,requestChange,decideChange,cancelOwn};
