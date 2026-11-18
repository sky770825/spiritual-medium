const {fail,dateString}=require('./scheduling');
const validUid=v=>typeof v==='string'&&/^U[0-9a-f]{32}$/i.test(v);
const contactTags=['待聯絡','已聯絡'];
function sourceBookings(state){return (state.bookings||[]).filter(b=>!b.archivedAt&&!b.isTest&&!String(b.name||'').startsWith('系統流程驗收測試'));}
function futureBooking(b,now){return (['confirmed','active'].includes(b.status)&&b.endAt>now)||(b.status==='pending'&&b.startAt>now&&b.expiresAt>now);}
function customers(bookings,s,now=Date.now()){
 const groups=new Map();for(const b of sourceBookings(bookings)){const linked=validUid(b.lineIdentity?.userId)&&Boolean(b.lineIdentity?.consentedAt),key=linked?b.lineIdentity.userId:b.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b);}
 return [...groups.values()].map(rows=>{rows.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));const b=rows[0],linked=validUid(b.lineIdentity?.userId)&&Boolean(b.lineIdentity?.consentedAt),userId=linked?b.lineIdentity.userId:null,p=(s.customerProfiles||[]).find(p=>p.userId===userId)||{},friend=s.friends.find(f=>f.userId===userId),next=rows.filter(x=>futureBooking(x,now)).sort((a,b)=>a.startAt-b.startAt)[0],last=b,returning=rows.some(x=>x.status==='completed'&&x.startAt<now)||(bookings.returningCustomers||[]).some(x=>x.userId===userId&&x.allowed);
 return {id:b.id,userId,name:b.name,contact:rows.find(x=>x.contact)?.contact||'',phone:b.phone||'',linked,type:returning?'回訪':'新客',count:rows.length,firstSubmittedAt:rows.some(x=>Number.isFinite(x.createdAt))?Math.min(...rows.map(x=>x.createdAt).filter(Number.isFinite)):null,lastSubmittedAt:b.createdAt||null,lastBooking:{date:last.date,time:last.time,status:last.status==='pending'&&last.expiresAt<=now?'expired':last.status,id:last.id},nextBooking:next?{date:next.date,time:next.time,status:next.status}:null,tags:p.tags||[],paused:p.paused===true,profileVersion:p.updatedAt||0,blocked:friend?.blocked===true,joinedAt:friend?.joinedAt||null,rows};
 }).sort((a,b)=>(b.lastSubmittedAt||0)-(a.lastSubmittedAt||0));
}
function publicCustomer(c){const {userId,rows,...safe}=c;return safe;}
function setProfile(s,bookings,input,now=Date.now()){
 const c=customers(bookings,s,now).find(c=>c.id===input.id);if(!c?.linked)fail('找不到已綁定的客戶，請重新整理',404);
 if(!Array.isArray(input.tags)||input.tags.length>1||input.tags.some(t=>!contactTags.includes(t))||typeof input.paused!=='boolean')fail('客戶標籤不正確');
 if(input.profileVersion!==c.profileVersion)fail('客戶標籤已被其他裝置更新，請重新整理',409);
 s.customerProfiles=s.customerProfiles||[];const existing=s.customerProfiles.find(p=>p.userId===c.userId),updatedAt=Math.max(now,c.profileVersion+1);const value={userId:c.userId,tags:input.tags,paused:input.paused,updatedAt};if(existing)Object.assign(existing,value);else s.customerProfiles.push(value);
 return {id:c.id,tags:input.tags,paused:input.paused,profileVersion:updatedAt};
}
function selection(input,now=Date.now()){
 const source=input.source??'friends';if(!['friends','customers'].includes(source))fail('受眾來源不正確');const since=input.since;if(typeof since!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(since))fail('請選擇受眾起始日期');const from=Date.parse(since+'T00:00:00+08:00');if(!Number.isFinite(from)||dateString(from)!==since||from>now)fail('受眾日期不正確');
 const excludeFuture=input.excludeFuture??true,excludeRecentDays=input.excludeRecentDays??7,tag=input.tag??'';if(typeof excludeFuture!=='boolean'||![0,1,3,7,14,30].includes(excludeRecentDays)||!['','新客','回訪',...contactTags].includes(tag))fail('受眾排除條件不正確');return {source,since,excludeFuture,excludeRecentDays,tag};
}
function choose(s,bookingState,input,now=Date.now(),ignoreCampaignId=null){
 const rule=selection(input,now),from=Date.parse(rule.since+'T00:00:00+08:00'),list=customers(bookingState,s,now),byId=new Map(list.filter(c=>c.linked).map(c=>[c.userId,c]));
 const base=rule.source==='friends'?s.friends.filter(f=>validUid(f.userId)&&Number.isFinite(f.joinedAt)&&f.joinedAt>=from&&f.joinedAt<=now).map(f=>f.userId):list.filter(c=>c.linked&&c.rows.some(b=>Number.isFinite(b.createdAt)&&b.createdAt>=from&&b.createdAt<=now)).map(c=>c.userId);
 const ids=[...new Set(base)],recent=new Set();if(rule.excludeRecentDays)for(const c of s.campaigns){if(c.id===ignoreCampaignId||c.test||c.status==='draft')continue;const at=c.acceptedAt||c.firstAttemptAt||c.lastAttemptAt||c.createdAt;if(at>=now-rule.excludeRecentDays*86400000)for(const id of c.recipients||[])recent.add(id);}
 const stats={total:ids.length,blocked:0,paused:0,tag:0,future:0,recent:0,selected:0},recipients=[];
 for(const id of ids){const c=byId.get(id),profile=(s.customerProfiles||[]).find(p=>p.userId===id);if(s.friends.some(f=>f.userId===id&&f.blocked)){stats.blocked++;continue;}if(profile?.paused){stats.paused++;continue;}if(rule.tag&&c?.type!==rule.tag&&!profile?.tags?.includes(rule.tag)){stats.tag++;continue;}if(rule.excludeFuture&&c?.nextBooking){stats.future++;continue;}if(recent.has(id)){stats.recent++;continue;}recipients.push(id);}
 stats.selected=recipients.length;return {recipients,stats,selection:rule};
}
module.exports={customers,publicCustomer,setProfile,choose,selection,futureBooking};
