function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readRawBody(req) {
  if (typeof req.body === "string") {
    return Promise.resolve(req.body);
  }

  if (Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body.toString("utf8"));
  }

  if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
    return Promise.resolve(JSON.stringify(req.body));
  }

  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
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
