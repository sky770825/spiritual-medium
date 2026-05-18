const { requireAdmin } = require("../../server/adminAuth");
const { sendJson } = require("../../server/http");

module.exports = async function adminHealth(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  return sendJson(res, 200, {
    ok: true,
    project: "spiritual-medium",
    hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
    hasGithubToken: Boolean(process.env.GITHUB_TOKEN),
    repo: process.env.GITHUB_REPO || "sky770825/spiritual-medium",
    branch: process.env.GITHUB_BRANCH || "main",
  });
};
