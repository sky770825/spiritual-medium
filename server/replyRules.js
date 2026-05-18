const fs = require("fs/promises");
const path = require("path");

const DEFAULT_REPO = "sky770825/spiritual-medium";
const DEFAULT_BRANCH = "main";
const REPLIES_PATH = "data/replies.json";
const LOCAL_REPLIES_PATH = path.join(process.cwd(), REPLIES_PATH);
const CACHE_TTL_MS = 15000;

let cachedConfig = null;
let cachedAt = 0;

function repoInfo() {
  return {
    repo: process.env.GITHUB_REPO || DEFAULT_REPO,
    branch: process.env.GITHUB_BRANCH || DEFAULT_BRANCH,
    token: process.env.GITHUB_TOKEN || "",
  };
}

function normalizeConfig(input) {
  const source = input && typeof input === "object" ? input : {};
  const rules = Array.isArray(source.rules) ? source.rules : [];

  return {
    version: Number(source.version || 1),
    brand: String(source.brand || "spiritual-medium"),
    updatedAt: source.updatedAt || new Date().toISOString(),
    rules: rules.map(normalizeRule).filter(Boolean),
  };
}

function normalizeRule(rule) {
  if (!rule || typeof rule !== "object") {
    return null;
  }

  const id = sanitizeId(rule.id || rule.name || cryptoId());
  const response = normalizeResponse(rule.response);

  return {
    id,
    enabled: rule.enabled !== false,
    trigger: ["follow", "message", "fallback"].includes(rule.trigger) ? rule.trigger : "message",
    priority: Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : 0,
    name: String(rule.name || id),
    keywords: normalizeKeywords(rule.keywords),
    response,
  };
}

function normalizeResponse(response) {
  const source = response && typeof response === "object" ? response : {};

  if (source.type === "flex") {
    return {
      type: "flex",
      altText: String(source.altText || source.title || "宇宙通靈師訊息").slice(0, 400),
      title: String(source.title || "宇宙通靈師").slice(0, 120),
      body: String(source.body || "").slice(0, 1000),
      imageUrl: String(source.imageUrl || ""),
      buttons: normalizeButtons(source.buttons),
    };
  }

  return {
    type: "text",
    text: String(source.text || "").slice(0, 5000),
  };
}

function normalizeButtons(buttons) {
  if (!Array.isArray(buttons)) {
    return [];
  }

  return buttons
    .map((button) => ({
      label: String(button?.label || "").slice(0, 40),
      type: button?.type === "message" ? "message" : "uri",
      value: String(button?.value || "").slice(0, 1000),
    }))
    .filter((button) => button.label && button.value)
    .slice(0, 4);
}

function normalizeKeywords(keywords) {
  if (Array.isArray(keywords)) {
    return keywords.map((keyword) => String(keyword).trim()).filter(Boolean);
  }

  if (typeof keywords === "string") {
    return keywords
      .split(/[\n,，]/)
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  return [];
}

function sanitizeId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || cryptoId();
}

function cryptoId() {
  return `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function loadReplyConfig(options = {}) {
  if (!options.fresh && cachedConfig && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const fromGithub = await readFromGithub().catch((error) => {
    console.error("Unable to read reply rules from GitHub", error);
    return null;
  });
  const config = fromGithub || (await readFromLocal());

  cachedConfig = normalizeConfig(config);
  cachedAt = Date.now();

  return cachedConfig;
}

async function readFromLocal() {
  const raw = await fs.readFile(LOCAL_REPLIES_PATH, "utf8");
  return JSON.parse(raw);
}

async function readFromGithub() {
  const { repo, branch, token } = repoInfo();
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "spiritual-medium-site",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `https://api.github.com/repos/${repo}/contents/${REPLIES_PATH}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub read failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = Buffer.from(payload.content || "", "base64").toString("utf8");
  return JSON.parse(content);
}

async function saveReplyConfig(input) {
  const { repo, branch, token } = repoInfo();

  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }

  const config = normalizeConfig({
    ...input,
    brand: "spiritual-medium",
    updatedAt: new Date().toISOString(),
  });
  const current = await getGithubContentMeta(repo, branch, token);
  const body = {
    message: "chore: update spiritual medium LINE reply rules",
    content: Buffer.from(`${JSON.stringify(config, null, 2)}\n`, "utf8").toString("base64"),
    branch,
  };

  if (current?.sha) {
    body.sha = current.sha;
  }

  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${REPLIES_PATH}`, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "spiritual-medium-site",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub save failed: ${response.status} ${errorText}`);
  }

  cachedConfig = config;
  cachedAt = Date.now();

  return {
    config,
    github: await response.json(),
  };
}

async function getGithubContentMeta(repo, branch, token) {
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${REPLIES_PATH}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "spiritual-medium-site",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub metadata failed: ${response.status}`);
  }

  return response.json();
}

function findReplyRule(config, event) {
  const rules = [...(config.rules || [])]
    .filter((rule) => rule.enabled)
    .sort((left, right) => right.priority - left.priority);

  if (event.type === "follow") {
    return rules.find((rule) => rule.trigger === "follow") || null;
  }

  if (event.type === "message" && event.message?.type === "text") {
    const text = event.message.text || "";
    const matched = rules.find((rule) => {
      return rule.trigger === "message" && rule.keywords.some((keyword) => matchesKeyword(keyword, text));
    });

    if (matched) {
      return matched;
    }
  }

  return rules.find((rule) => rule.trigger === "fallback") || null;
}

function matchesKeyword(pattern, incoming) {
  const source = String(incoming || "").trim().toLowerCase();
  const trigger = String(pattern || "").trim().toLowerCase();

  if (!trigger) {
    return false;
  }

  if (trigger === "*") {
    return true;
  }

  const startsWithWildcard = trigger.startsWith("*");
  const endsWithWildcard = trigger.endsWith("*");
  const keyword = trigger.replace(/^\*+|\*+$/g, "");

  if (!keyword) {
    return true;
  }

  if (startsWithWildcard && endsWithWildcard) {
    return source.includes(keyword);
  }

  if (startsWithWildcard) {
    return source.endsWith(keyword);
  }

  if (endsWithWildcard) {
    return source.startsWith(keyword);
  }

  return source === keyword;
}

module.exports = {
  findReplyRule,
  loadReplyConfig,
  matchesKeyword,
  normalizeConfig,
  saveReplyConfig,
};
