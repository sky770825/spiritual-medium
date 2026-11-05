const {get,put,BlobPreconditionFailedError}=require('@vercel/blob');
const {defaultState,fail}=require('./scheduling');
const KEY=process.env.BOOKING_STATE_KEY||'booking/state-v1.json';
async function read(){const r=await get(KEY,{access:'private',useCache:false});if(!r)return {state:defaultState(),etag:null};const state=await new Response(r.stream).json();if(state.version<1||!Array.isArray(state.bookings)||!state.config)throw new Error('Invalid booking store');return {state,etag:r.blob.etag.replace(/^W\//,'')};}
async function write(state,etag){return put(KEY,JSON.stringify(state),{access:'private',addRandomSuffix:false,contentType:'application/json',allowOverwrite:Boolean(etag),...(etag?{ifMatch:etag}:{}),cacheControlMaxAge:60});}
function createTransactions(adapter){return async function mutate(fn){for(let attempt=0;attempt<6;attempt++){const {state,etag}=await adapter.read();const result=await fn(state);state.version++;try{await adapter.write(state,etag);return result;}catch(e){if(!(e instanceof BlobPreconditionFailedError)&&!['BlobPreconditionFailedError','BlobAlreadyExistsError','ConflictError'].includes(e.name)&&!(etag===null&&/already exists/i.test(e.message)))throw e;if(attempt===5)fail('系統正在處理其他預約，請稍後重試',409);await new Promise(r=>setTimeout(r,30*(attempt+1)));}}};}
module.exports={read,mutate:createTransactions({read,write}),createTransactions};
