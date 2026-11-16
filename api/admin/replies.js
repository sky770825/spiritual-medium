const { requireAdmin } = require("../../server/adminAuth");
const { readJsonBody, sendJson } = require("../../server/http");
const { loadReplyConfig, saveReplyConfig } = require("../../server/replyRules");

module.exports = async function adminReplies(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (!await requireAdmin(req, res)) {
    return;
  }

  if (req.method === "GET") {
    try {
      const config = await loadReplyConfig({ fresh: true });
      return sendJson(res, 200, {ok:true,config,repo:process.env.GITHUB_REPO || "sky770825/spiritual-medium",branch:process.env.GITHUB_BRANCH || "main",writable:Boolean(process.env.GITHUB_TOKEN)});
    } catch {return sendJson(res,503,{ok:false,error:"暫時無法讀取回覆規則，請稍後重試"});}
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
      console.error("reply rule save failed", error.name);
      return sendJson(res, error.status===413?413:500, {
        ok: false,
        error: error.status===413?"資料太長":"無法儲存回覆規則，請檢查設定或稍後重試",
      });
    }
  }

  res.setHeader("Allow", "GET, PUT, POST, OPTIONS");
  return sendJson(res, 405, { ok: false, error: "Method not allowed" });
};
