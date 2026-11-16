const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../manage.js'),'utf8');
test('binding links take precedence over a prior self-service OAuth session',()=>{let removed=false;vm.runInNewContext(source,{URLSearchParams,location:{hash:'#bind=1&id=test'},sessionStorage:{removeItem(k){if(k==='booking-manage-mode')removed=true;}},document:{getElementById(){throw Error('must not enter manage mode');}}});assert.equal(removed,true);});
