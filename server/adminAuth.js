const crypto = require("crypto");
const { sendJson } = require("./http");

function extractBearerToken(req) {
  const authorization = req.headers.authorization || req.headers.Authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(left || "");
  const rightBuffer = Buffer.from(right || "");

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

async function requireAdmin(req, res) {
  const adminPassword = process.env.ADMIN_PASSWORD || "";

  if (!adminPassword) {
    sendJson(res, 503, {
      ok: false,
      error: "ADMIN_PASSWORD is not configured",
    });
    return false;
  }

  const valid = secureEqual(extractBearerToken(req), adminPassword);
  const {client}=require('./booking-api');
  const key='reply-login-'+client(req),now=Date.now();
  try {
    const allowed=await require('./booking-store').mutate(s=>{
      s.rate=(s.rate||[]).filter(x=>x.at>now-3600000);
      if(s.rate.filter(x=>x.client===key&&x.at>now-900000).length>=8)return false;
      if(!valid)s.rate.push({client:key,at:now});return true;
    });
    if(!allowed){sendJson(res,429,{ok:false,error:'登入嘗試過多，請15分鐘後再試'});return false;}
  } catch {sendJson(res,503,{ok:false,error:'登入驗證暫時無法連線，請稍後再試'});return false;}

  if (!valid) {
    sendJson(res, 401, {
      ok: false,
      error: "Unauthorized",
    });
    return false;
  }

  return true;
}

module.exports = {
  requireAdmin,
};
