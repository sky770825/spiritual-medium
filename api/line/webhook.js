const crypto = require("crypto");

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

function isValidSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

function buildTextReply(event) {
  if (event.type === "follow") {
    return {
      type: "text",
      text: "謝謝你加入宇宙通靈師。若想預約諮詢，請回覆想了解的服務項目、方便時段，以及你想詢問的主題。",
    };
  }

  if (event.type !== "message" || event.message?.type !== "text") {
    return null;
  }

  const text = event.message.text.trim();
  const normalized = text.toLowerCase();

  if (/預約|預定|諮詢|咨詢|報名|時間/.test(text)) {
    return {
      type: "text",
      text: "收到你的預約需求。請回覆：\n1. 想預約的服務項目\n2. 方便諮詢的日期與時間\n3. 想詢問的主題或背景\n\n服務時間：10:00 - 22:00。",
    };
  }

  if (/服務|項目|價格|收費|費用|內容/.test(text)) {
    return {
      type: "text",
      text: "目前服務包含：靈魂對話、能量療癒、命運指引、陰陽平衡。你可以直接回覆想了解的項目，我會協助你安排適合的諮詢方式。",
    };
  }

  if (normalized === "test" || text === "測試") {
    return {
      type: "text",
      text: "LINE webhook 已連線成功。",
    };
  }

  return {
    type: "text",
    text: "我收到你的訊息了。宇宙通靈師會在服務時間 10:00 - 22:00 回覆你。若想預約，請留下服務項目、方便時段與想詢問的主題。",
  };
}

async function replyToLine(replyToken, message, channelAccessToken) {
  if (!replyToken || !message || !channelAccessToken) {
    return { skipped: true };
  }

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [message],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE reply failed: ${response.status} ${errorText}`);
  }

  return { skipped: false };
}

module.exports = async function lineWebhook(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      service: "spiritual-medium-line-webhook",
      hasChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
      hasChannelAccessToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
    });
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelSecret) {
    return sendJson(res, 503, {
      ok: false,
      error: "LINE_CHANNEL_SECRET is not configured",
    });
  }

  let rawBody = "";

  try {
    rawBody = await readRawBody(req);
  } catch (error) {
    console.error(error);
    return sendJson(res, 400, { ok: false, error: "Unable to read request body" });
  }

  const signature = req.headers["x-line-signature"];

  if (!isValidSignature(rawBody, signature, channelSecret)) {
    return sendJson(res, 401, { ok: false, error: "Invalid LINE signature" });
  }

  let payload;

  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    console.error(error);
    return sendJson(res, 400, { ok: false, error: "Invalid JSON payload" });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];
  const results = await Promise.allSettled(
    events.map((event) => {
      const reply = buildTextReply(event);
      return replyToLine(event.replyToken, reply, channelAccessToken);
    })
  );

  const failed = results.filter((result) => result.status === "rejected");

  failed.forEach((result) => console.error(result.reason));

  return sendJson(res, 200, {
    ok: true,
    received: events.length,
    replied: results.length - failed.length,
    failed: failed.length,
  });
};
