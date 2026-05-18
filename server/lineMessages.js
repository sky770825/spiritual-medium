function buildMessagesForRule(rule) {
  if (!rule?.response) {
    return [];
  }

  if (rule.response.type === "flex") {
    return [buildFlexMessage(rule.response)];
  }

  if (rule.response.text) {
    return [
      {
        type: "text",
        text: rule.response.text,
      },
    ];
  }

  return [];
}

function buildFlexMessage(response) {
  const bodyContents = [
    {
      type: "text",
      text: response.title || "宇宙通靈師",
      weight: "bold",
      size: "xl",
      color: "#2D1B4E",
      wrap: true,
    },
  ];

  if (response.body) {
    bodyContents.push({
      type: "text",
      text: response.body,
      size: "sm",
      color: "#5F536F",
      wrap: true,
      margin: "md",
    });
  }

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: bodyContents,
    },
  };

  if (isHttpsUrl(response.imageUrl)) {
    bubble.hero = {
      type: "image",
      url: response.imageUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    };
  }

  const footerButtons = buildFlexButtons(response.buttons || []);

  if (footerButtons.length) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: footerButtons,
    };
  }

  return {
    type: "flex",
    altText: response.altText || response.title || "宇宙通靈師訊息",
    contents: bubble,
  };
}

function buildFlexButtons(buttons) {
  return buttons
    .filter((button) => {
      if (!button.label || !button.value) {
        return false;
      }

      return button.type === "message" || isHttpsUrl(button.value);
    })
    .slice(0, 4)
    .map((button) => ({
      type: "button",
      style: "primary",
      height: "sm",
      color: button.type === "message" ? "#6B3FA0" : "#D4AF37",
      action:
        button.type === "message"
          ? {
              type: "message",
              label: button.label,
              text: button.value,
            }
          : {
              type: "uri",
              label: button.label,
              uri: button.value,
            },
    }));
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

async function replyToLine(replyToken, messages, channelAccessToken) {
  if (!replyToken || !messages.length || !channelAccessToken || isVerifyReplyToken(replyToken)) {
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
      messages: messages.slice(0, 5),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE reply failed: ${response.status} ${errorText}`);
  }

  return { skipped: false };
}

function isVerifyReplyToken(replyToken) {
  return /^0+$/.test(String(replyToken || ""));
}

module.exports = {
  buildMessagesForRule,
  replyToLine,
};
