const {createHmac,timingSafeEqual,createHash}=require('node:crypto');
const {fail}=require('./scheduling');
function send(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));}
async function body(req){
 if(Number(req.headers['content-length']||0)>12000)fail('資料太長',413);
 let raw;
 if(req.body!==undefined){raw=typeof req.body==='string'?req.body:Buffer.isBuffer(req.body)?req.body.toString():JSON.stringify(req.body);}
 else{const chunks=[];let size=0;for await(const chunk of req){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>12000)fail('資料太長',413);chunks.push(bytes);}raw=Buffer.concat(chunks).toString()||'{}';}
 if(Buffer.byteLength(raw)>12000)fail('資料太長',413);
 let input;try{input=JSON.parse(raw);}catch{fail('資料格式不正確');}
 if(!input||typeof input!=='object'||Array.isArray(input))fail('資料格式不正確');
 return input;
}
function origin(req){const source=req.headers.origin;if(source){let parsed;try{parsed=new URL(source);}catch{fail('來源不正確',403);}if(parsed.host!==req.headers.host)fail('來源不正確',403);}if(req.headers['sec-fetch-site']==='cross-site')fail('來源不正確',403);}
function secret(){const s=process.env.BOOKING_ADMIN_PASSWORD;if(!s)fail('預約管理尚未設定',503);return s;}
function equal(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
function sessionSecret(){const s=process.env.BOOKING_SESSION_SECRET;if(!s||Buffer.byteLength(s)<32)fail('預約管理登入尚未設定',503);return s;}
function digest(s){return createHmac('sha256',sessionSecret()).update(s).digest('base64url');}
function cookie(res){const payload=Buffer.from(JSON.stringify({exp:Date.now()+8*3600000,scope:'booking-admin'})).toString('base64url');res.setHeader('Set-Cookie',`booking_admin=${payload}.${digest(payload)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`);}
function authenticated(req){const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('booking_admin='))?.slice(14);if(!raw||raw.length>1024)return false;const parts=raw.split('.');if(parts.length!==2)return false;const [p,sig]=parts;if(!p||!sig||!equal(sig,digest(p)))return false;try{const d=JSON.parse(Buffer.from(p,'base64url'));return d.scope==='booking-admin'&&Number.isFinite(d.exp)&&d.exp>Date.now()&&d.exp<=Date.now()+8*3600000;}catch{return false;}}
function client(req){return createHash('sha256').update((process.env.BOOKING_ADMIN_PASSWORD||'booking')+'|'+(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0]).digest('hex').slice(0,32);}
function handleError(res,e){const status=e.status||503;if(status>=500)console.error('booking error:',e.name);send(res,status,{ok:false,error:e.status?e.message:'預約服務暫時無法連線，請稍後重試；也可透過LINE聯絡。'});}
module.exports={send,body,origin,equal,secret,cookie,authenticated,client,handleError};
