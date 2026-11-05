(function(root){
 const LIFF_ID='2012387050-7GZmUUJ4';
 function canSend(inClient,context,permissions,consent){return Boolean(inClient&&context?.type==='utou'&&permissions.includes('chat_message.write')&&consent);}
 function notificationText(b,name){return ['【新預約申請・待老師確認】','宇宙玉皇大帝原始大天尊無上至尊',`預約編號：${b.id}`,`姓名：${name}`,`時間：${b.date} ${b.time}（台北時間）`,`時長：${b.duration}分鐘｜NT$${b.price}`,'請老師在預約管理行事曆核對並確認。'].join('\n');}
 if(typeof module==='object'&&module.exports){module.exports={canSend,notificationText};return;}
 let sdk=null,inClient=false,context=null,permissions=[],sent=new Set();
 const ready=(async()=>{try{await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://static.line-scdn.net/liff/edge/2/sdk.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});sdk=root.liff;await sdk.init({liffId:LIFF_ID,withLoginOnExternalBrowser:false});inClient=sdk.isInClient();context=sdk.getContext();if(inClient)permissions=await sdk.permission.getGrantedAll();const available=canSend(inClient,context,permissions,true);const box=document.getElementById('line-consent-box');if(box)box.hidden=!available;return available;}catch{return false;}})();
 root.bookingLine={ready,notificationText,async send(b,name){const consent=document.getElementById('line-notify-consent')?.checked===true;if(!consent)return {sent:false,reason:'manual'};const available=await ready;if(!available||!canSend(inClient,context,permissions,consent))return {sent:false,reason:'manual'};if(sent.has(b.id))return {sent:true};try{await sdk.sendMessages([{type:'text',text:notificationText(b,name)}]);sent.add(b.id);return {sent:true};}catch{return {sent:false,reason:'failed'};}}};
})(typeof window!=='undefined'?window:globalThis);
