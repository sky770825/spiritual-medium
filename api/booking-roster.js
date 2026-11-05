const store=require('../server/booking-store');
const {send,equal,authenticated,handleError}=require('../server/booking-api');
const {rosterSnapshot}=require('../server/booking-roster');
module.exports=async(req,res)=>{try{
 if(req.method!=='GET'){res.setHeader('Allow','GET');return send(res,405,{ok:false,error:'不支援的操作'});}
 const token=process.env.BOOKING_ROSTER_TOKEN||'',supplied=(req.headers.authorization||'').replace(/^Bearer /,'');
 const syncAllowed=token.length>=32&&equal(supplied,token);
 if(!syncAllowed&&!authenticated(req))return send(res,401,{ok:false,error:'請登入預約管理'});
 const {state}=await store.read();return send(res,200,rosterSnapshot(state));
 }catch(e){handleError(res,e);}};
