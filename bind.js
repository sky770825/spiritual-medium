(() => {
 const form=document.getElementById('binding-form'),button=document.getElementById('bind-submit'),status=document.getElementById('binding-status'),key='booking-line-binding';
 let credential=null,busy=false;
 try{
  const params=new URLSearchParams(location.hash.slice(1));
  if(!params.has('bind')&&!sessionStorage.getItem(key))return;
  document.body.classList.add('binding-mode');document.getElementById('binding-panel').hidden=false;
  document.getElementById('line-access').open=true;
  document.querySelector('.event-profile h1').textContent='補綁預約LINE通知';
  document.getElementById('binding-exit').addEventListener('click',()=>{sessionStorage.removeItem(key);location.assign('/reserve.html');});
  if(params.has('id')&&params.has('token')){
   credential={id:params.get('id'),token:params.get('token')};
   // Keep credentials out of OAuth redirects, referrers, and browser address bars.
   history.replaceState(null,'',location.pathname+location.search);
   sessionStorage.setItem(key,JSON.stringify(credential));
  }else credential=JSON.parse(sessionStorage.getItem(key)||'null');
  if(!credential||!/^[0-9a-f-]{36}$/i.test(credential.id)||!/^[A-Za-z0-9_-]{43}$/.test(credential.token))throw Error('請使用老師提供的完整補綁連結，或聯絡老師重新產生。');
 }catch(e){button.disabled=true;status.textContent=e instanceof SyntaxError?'補綁資料無法讀取，請重新開啟老師提供的連結。':e.message||'請允許網站儲存，再重新開啟補綁連結。';credential=null;}
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!credential)return;busy=true;button.disabled=true;status.textContent='正在驗證LINE身分並綁定…';
  try{
   const identity=await window.bookingLine.identity();if(!identity.lineIdToken)throw Error('請先登入LINE，再勾選同意綁定。');
   const response=await fetch('/api/booking-bind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...credential,...identity})}),data=await response.json();
   if(!response.ok)throw Error(data.error||'補綁未完成，請聯絡老師。');
   sessionStorage.removeItem(key);credential=null;form.hidden=true;
   status.textContent=`LINE綁定成功。預約：${data.date} ${data.time}（台北時間）。`+(data.status==='confirmed'?'這筆預約已核准，請留意官方LINE；如未收到訊息請聯絡老師。':'請等待老師審核，核准或取消結果會透過官方LINE通知。');
  }catch(e){status.textContent=e.message||'連線中斷，請再試一次。';}finally{busy=false;if(credential)button.disabled=false;}
 });
})();
