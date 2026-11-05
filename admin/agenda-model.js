(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AgendaModel=api;})(typeof window==='object'?window:globalThis,function(){
 const minutes=t=>{if(t==='24:00')return 1440;const [h,m]=String(t).split(':').map(Number);return h*60+m;};
 const format=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
 const status=(b,now)=>b.status==='pending'&&b.expiresAt<=now?'expired':b.status;
 function dayBookings(state,date,{now=Date.now(),filter='valid',query=''}={}){const q=query.trim().toLocaleLowerCase();return state.bookings.filter(b=>b.date===date).map(b=>({...b,status:status(b,now)})).filter(b=>filter==='archived'?Boolean(b.archivedAt):!b.archivedAt).filter(b=>filter==='archived'||filter==='all'||(filter==='valid'?!['cancelled','expired'].includes(b.status):b.status===filter)).filter(b=>!q||[b.name,b.contact,b.question,b.id].some(v=>String(v||'').toLocaleLowerCase().includes(q))).sort((a,b)=>a.startAt-b.startAt||a.id.localeCompare(b.id));}
 function daySummary(state,date,now=Date.now()){const list=dayBookings(state,date,{now});return {count:list.length,pending:list.filter(b=>b.status==='pending').length,confirmed:list.filter(b=>['confirmed','active'].includes(b.status)).length,minutes:list.reduce((n,b)=>n+b.duration,0)};}
 function weekDates(date){const base=Date.parse(date+'T12:00:00+08:00'),offset=new Date(base).getUTCDay();return Array.from({length:7},(_,i)=>new Date(base+(i-offset)*86400000+8*3600000).toISOString().slice(0,10));}
 function dayTimeline(state,date,now=Date.now()){
  const bookings=dayBookings(state,date,{now}),blocks=state.blocks.filter(b=>b.date===date),weekday=new Date(date+'T12:00:00+08:00').getUTCDay(),windows=state.config.enabled?(state.config.weekly[weekday]||[]):[];
  const points=new Set([0,1440,1200,1320,minutes(state.config.latestStartTime||'23:00')]);
  for(const w of windows){points.add(minutes(w.start));points.add(minutes(w.end));}
  for(const b of blocks){points.add(minutes(b.start));points.add(minutes(b.end));}
  for(const b of bookings){const a=minutes(b.time);points.add(a);points.add(a+b.duration);points.add(Math.min(1440,a+(b.busyEndAt-b.startAt)/60000));}
  const sorted=[...points].filter(Number.isFinite).filter(m=>m>=0&&m<=1440).sort((a,b)=>a-b),rows=[];
  for(let i=0;i<sorted.length-1;i++){const start=sorted[i],end=sorted[i+1];if(start===end)continue;let kind='closed',booking=null,block=null;
   booking=bookings.find(b=>{const m=minutes(b.time);return start>=m&&start<m+b.duration;});
   if(booking)kind='booking';else if((booking=bookings.find(b=>{const m=minutes(b.time);return start>=m+b.duration&&start<m+(b.busyEndAt-b.startAt)/60000;})))kind='buffer';
   else if((block=blocks.find(b=>start>=minutes(b.start)&&start<minutes(b.end))))kind='block';
   else if(windows.some(w=>start>=minutes(w.start)&&start<minutes(w.end)))kind=start>=minutes(state.config.latestStartTime||'23:00')?'closing':'open';
   else if(start>=1200&&start<1320)kind='live';
   const prev=rows.at(-1);if(prev&&prev.kind===kind&&prev.booking?.id===booking?.id&&prev.block?.id===block?.id&&prev.end===start)prev.end=end;else rows.push({kind,start,end,...(booking?{booking}:{}),...(block?{block}:{} )});
  }return rows;
 }
 function copySchedule(state,date,now=Date.now()){const list=dayBookings(state,date,{now});const rows=dayTimeline(state,date,now).filter(r=>['booking','buffer','block','live'].includes(r.kind));return [`【${date} 老師當日預約與休息時間表】`,`問事${list.length}場，共${list.reduce((n,b)=>n+b.duration,0)}分鐘`,...rows.map(r=>{const time=format(r.start)+'–'+format(r.end);if(r.kind==='booking'){const b=r.booking;return `${time}　${b.name}｜${b.duration}分鐘｜${({pending:'待確認',confirmed:'已確認',active:'交流中',completed:'已完成'})[b.status]||b.status}`;}return time+'　'+({buffer:'場間休息',block:'私人行程／休息',live:'直播，不排預約'})[r.kind];}),`${state.config.latestStartTime||'23:00'}　最後可開始預約，午夜前結束`].join('\n');}
 return {minutes,format,status,dayBookings,daySummary,dayTimeline,weekDates,copySchedule};
});
