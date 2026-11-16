function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(payload));
}

function readRawBody(req) {
  const limit=1024*1024;
  function checked(value){if(Buffer.byteLength(value)>limit){const e=new Error('Request body too large');e.status=413;throw e;}return value;}
  if(Number(req.headers?.['content-length']||0)>limit)return Promise.reject(Object.assign(new Error('Request body too large'),{status:413}));
  if(typeof req.body==='string')return Promise.resolve().then(()=>checked(req.body));
  if(Buffer.isBuffer(req.body))return Promise.resolve().then(()=>checked(req.body.toString('utf8')));
  if(req.body!==undefined)return Promise.resolve().then(()=>checked(JSON.stringify(req.body)));
  return new Promise((resolve,reject)=>{const chunks=[];let size=0,over=false;
    req.on('data',chunk=>{if(over)return;const bytes=Buffer.from(chunk);size+=bytes.length;if(size>limit){over=true;reject(Object.assign(new Error('Request body too large'),{status:413}));return;}chunks.push(bytes);});
    req.on('end',()=>{if(!over)resolve(Buffer.concat(chunks).toString('utf8'));});req.on('error',reject);
  });
}

async function readJsonBody(req) {
  const rawBody = await readRawBody(req);

  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
}

module.exports = {
  readJsonBody,
  readRawBody,
  sendJson,
};
