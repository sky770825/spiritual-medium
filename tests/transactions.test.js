const {test}=require('node:test');const assert=require('node:assert/strict');
const {createTransactions}=require('../server/booking-store');const {defaultState,reserve}=require('../server/scheduling');
test('concurrent independent transactions cannot both reserve an overlapping slot',async()=>{
 let value=defaultState(),version=0;
 const adapter={async read(){await new Promise(r=>setTimeout(r,1));return {state:structuredClone(value),etag:version};},async write(next,etag){if(etag!==version){const e=new Error();e.name='ConflictError';throw e;}version++;value=structuredClone(next);}};
 const mutate=createTransactions(adapter),now=Date.parse('2026-11-05T08:00:00+08:00');
 const input={date:'2026-11-06',time:'14:00',duration:20,name:'測試',contact:'測試',question:'',signature:'測試',consent:true};
 const results=await Promise.allSettled([1,2,3].map(i=>mutate(s=>reserve(s,{...input,requestId:crypto.randomUUID()},now,'c'+i))));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(value.bookings.length,1);
});

test('retries SDK precondition errors even when Error.name is generic',async()=>{
 const {BlobPreconditionFailedError}=require('@vercel/blob');let tries=0;
 const run=createTransactions({async read(){return {state:defaultState(),etag:'"v1"'};},async write(){if(tries++===0)throw new BlobPreconditionFailedError();}});
 assert.equal(await run(()=>123),123);assert.equal(tries,2);
});
