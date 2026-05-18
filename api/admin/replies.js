const { requireAdmin } = require("../../server/adminAuth");
const { readJsonBody, sendJson } = require("../../server/http");
const { loadReplyConfig, saveReplyConfig } = require("../../server/replyRules");

module.exports = async function adminReplies(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (!requireAdmin(req, res)) {
    return;
  }

  if (req.method === "GET") {
    const config = await loadReplyConfig({ fresh: true });
    return sendJson(res, 200, {
      ok: true,
      config,
      repo: process.env.GITHUB_REPO || "sky770825/spiritual-medium",
      branch: process.env.GITHUB_BRANCH || "main",
      writable: Boolean(process.env.GITHUB_TOKEN),
    });
  }

  if (req.method === "PUT" || req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const result = await saveReplyConfig(body.config || body);

      return sendJson(res, 200, {
        ok: true,
        config: result.config,
        commit: result.github?.commit?.sha || "",
        url: result.github?.commit?.html_url || "",
      });
    } catch (error) {
      console.error(error);
      return sendJson(res, 500, {
        ok: false,
        error: error.message || "Unable to save reply rules",
      });
    }
  }

  res.setHeader("Allow", "GET, PUT, POST, OPTIONS");
  return sendJson(res, 405, { ok: false, error: "Method not allowed" });
};
