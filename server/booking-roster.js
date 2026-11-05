const HEADERS=['預約日期','開始','結束','姓名','LINE名稱','分鐘','費用(NT$)','預約狀態','LINE通知','預約編號','更新時間'];
const labels={pending:'待確認',confirmed:'已確認',active:'交流中',completed:'已完成',cancelled:'已取消',expired:'暫留到期'};
const notices={queued:'等待傳送',sending:'傳送中',accepted:'LINE已受理',failed:'發送失敗',manual:'人工聯絡',superseded:'已進入下一階段'};
const safe=value=>typeof value==='string'&&/^[=+\-@\t\r]/.test(value)?"'"+value:value??'';
function rosterSnapshot(s,now=Date.now()){
 const clock=ms=>Number.isFinite(ms)?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false}).format(ms):'';
 const rows=s.bookings.filter(b=>!b.archivedAt).sort((a,b)=>a.startAt-b.startAt||String(a.id).localeCompare(String(b.id))).map(b=>[b.date,b.time,clock(b.endAt),safe(b.name),safe(b.contact),b.duration,b.price,labels[b.status==='pending'&&b.expiresAt<=now?'expired':b.status]||b.status,notices[b.notification?.state]||(b.lineIdentity?'尚無結果通知':'人工聯絡'),b.id,b.updatedAt||b.createdAt||'']);
 return {ok:true,version:s.version,generatedAt:now,timezone:'Asia/Taipei',headers:HEADERS,rows};
}
module.exports={HEADERS,rosterSnapshot};
