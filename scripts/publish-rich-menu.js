const fs = require("fs");
const path = require("path");

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const IMAGE_PATH = path.join(process.cwd(), "assets/images/rich-menu-frequency-sync.jpg");
const RICH_MENU_NAME = "宇宙通靈師｜頻率同步選單";

if (!CHANNEL_ACCESS_TOKEN) {
  console.error("LINE_CHANNEL_ACCESS_TOKEN is required.");
  process.exit(1);
}

const richMenu = {
  size: {
    width: 1536,
    height: 1024,
  },
  selected: true,
  name: RICH_MENU_NAME,
  chatBarText: "頻率同步選單",
  areas: [
    area(0, 0, "真人訊號連線"),
    area(512, 0, "工作／事業"),
    area(1024, 0, "感情／關係"),
    area(0, 512, "財運／運勢"),
    area(512, 512, "健康／家庭"),
    area(1024, 512, "主神／亡靈"),
  ],
};

function area(x, y, text) {
  return {
    bounds: {
      x,
      y,
      width: 512,
      height: 512,
    },
    action: {
      type: "message",
      label: text,
      text,
    },
  };
}

async function lineRequest(pathname, options = {}) {
  const { dataApi, ...requestOptions } = options;
  const host = dataApi ? "api-data.line.me" : "api.line.me";
  const response = await fetch(`https://${host}${pathname}`, {
    ...requestOptions,
    headers: {
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = {};

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${pathname} failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body;
}

async function main() {
  if (!fs.existsSync(IMAGE_PATH)) {
    throw new Error(`Image not found: ${IMAGE_PATH}`);
  }

  const image = fs.readFileSync(IMAGE_PATH);

  await lineRequest("/v2/bot/richmenu/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(richMenu),
  });

  const created = await lineRequest("/v2/bot/richmenu", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(richMenu),
  });
  const richMenuId = created.richMenuId;

  await lineRequest(`/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    dataApi: true,
    headers: {
      "Content-Type": "image/jpeg",
    },
    body: image,
  });

  await lineRequest(`/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: "POST",
  });

  console.log(JSON.stringify({
    ok: true,
    richMenuId,
    name: richMenu.name,
    areas: richMenu.areas.map((item) => item.action.text),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
