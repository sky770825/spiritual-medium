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

function requireAdmin(req, res) {
  const adminPassword = process.env.ADMIN_PASSWORD || "";

  if (!adminPassword) {
    sendJson(res, 503, {
      ok: false,
      error: "ADMIN_PASSWORD is not configured",
    });
    return false;
  }

  if (!secureEqual(extractBearerToken(req), adminPassword)) {
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
