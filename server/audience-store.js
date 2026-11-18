const {get,put}=require('@vercel/blob');
const {createTransactions}=require('./booking-store');
const KEY='booking/audience-v1.json';
function empty(){return {version:1,friends:[],campaigns:[],trackingStartedAt:null};}
async function read(){const r=await get(KEY,{access:'private',useCache:false});if(!r)return {state:empty(),etag:null};const state=await new Response(r.stream).json();if(!Array.isArray(state.friends)||!Array.isArray(state.campaigns)||state.version<1)throw Error('Invalid audience store');return {state,etag:r.blob.etag.replace(/^W\//,'')};}
async function write(s,etag){return put(KEY,JSON.stringify(s),{access:'private',addRandomSuffix:false,allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{}),contentType:'application/json',cacheControlMaxAge:60});}
module.exports={read,mutate:createTransactions({read,write}),empty};
