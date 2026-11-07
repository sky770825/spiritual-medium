const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../bind'),'utf8');
function start({hash='',store=new Map(),identity={lineIdToken:'verified',lineConsent:true}}={}){
 const ids={};for(const id of ['binding-form','bind-submit','binding-status','binding-panel','line-access','binding-exit'])ids[id]={hidden:false,disabled:false,textContent:'',addEventListener(event,fn){this[event]=fn;}};
 let replaced,assigned,fetches=0;const head={textContent:''},classes=[];
 const context={URLSearchParams,history:{replaceState(a,b,url){replaced=url;}},location:{hash,pathname:'/reserve.html',search:'',assign(url){assigned=url;}},sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},document:{getElementById:id=>ids[id],querySelector:()=>head,body:{classList:{add(c){classes.push(c);}}}},window:{bookingLine:{identity:async()=>identity}},fetch:async(url,options)=>{fetches++;assert.equal(url,'/api/booking-bind');const body=JSON.parse(options.body);assert.equal(body.token,'a'.repeat(43));assert.equal(body.lineIdToken,'verified');return {ok:true,json:async()=>({date:'2026-11-14',time:'19:00',status:'pending'})};}};
 vm.runInNewContext(source,context);return {ids,store,classes,get replaced(){return replaced;},get fetches(){return fetches;},get assigned(){return assigned;}};
}
const fragment='#bind=1&id=12345678-1234-1234-1234-123456789012&token='+'a'.repeat(43);
test('supplemental binding survives normal LINE login redirect and removes credentials from address before SDK loads',async()=>{
 const first=start({hash:fragment});assert.equal(first.replaced,'/reserve.html');assert.ok(first.store.has('booking-line-binding'));assert.deepEqual(first.classes,['binding-mode']);
 const returned=start({store:first.store});assert.deepEqual(returned.classes,['binding-mode']);assert.equal(returned.ids['line-access'].open,true);
 await returned.ids['binding-form'].submit({preventDefault(){}});assert.equal(returned.fetches,1);assert.equal(returned.store.size,0);assert.equal(returned.ids['binding-form'].hidden,true);assert.match(returned.ids['binding-status'].textContent,/綁定成功/);
});
test('normal reservation page stays normal, missing consent never posts, and customer can leave binding mode',async()=>{
 const normal=start();assert.deepEqual(normal.classes,[]);assert.equal(normal.ids['binding-form'].submit,undefined);
 const x=start({hash:fragment,identity:{}});await x.ids['binding-form'].submit({preventDefault(){}});assert.equal(x.fetches,0);assert.match(x.ids['binding-status'].textContent,/登入LINE/);assert.equal(x.ids['bind-submit'].disabled,false);
 x.ids['binding-exit'].click();assert.equal(x.store.size,0);assert.equal(x.assigned,'/reserve.html');
});
