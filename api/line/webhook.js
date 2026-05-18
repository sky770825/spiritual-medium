const crypto = require("crypto");
const { readRawBody, sendJson } = require("../../server/http");
const { buildMessagesForRule, replyToLine } = require("../../server/lineMessages");
const { findReplyRule, loadReplyConfig } = require("../../server/replyRules");

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

module.exports = async function lineWebhook(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      service: "spiritual-medium-line-webhook",
      hasChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
      hasChannelAccessToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
      rulesSource: process.env.GITHUB_REPO || "sky770825/spiritual-medium",
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
  const config = await loadReplyConfig();
  const results = await Promise.allSettled(
    events.map((event) => {
      const rule = findReplyRule(config, event);
      const messages = buildMessagesForRule(rule);
      return replyToLine(event.replyToken, messages, channelAccessToken).then((result) => ({
        ...result,
        matchedRule: rule?.name || "",
        messageTypes: messages.map((message) => message.type),
      }));
    })
  );

  const failed = results.filter((result) => result.status === "rejected");
  const fulfilled = results.filter((result) => result.status === "fulfilled");

  failed.forEach((result) => console.error(result.reason));

  return sendJson(res, 200, {
    ok: true,
    received: events.length,
    replied: results.length - failed.length,
    failed: failed.length,
    matchedRules: fulfilled.map((result) => result.value.matchedRule).filter(Boolean),
  });
};
