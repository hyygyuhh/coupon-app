import { hmac } from "./crypto";

export interface FeishuMessage {
  msg_type: "text" | "post";
  content?: string;
  post?: {
    zh_cn: {
      title: string;
      content: string[][];
    };
  };
}

export async function sendFeishuMessage(
  webhook: string,
  secret: string | undefined,
  message: FeishuMessage
): Promise<boolean> {
  try {
    let url = webhook;
    
    if (secret) {
      const timestamp = Date.now();
      const nonce = Math.random().toString(36).slice(2, 15);
      const stringToSign = `${timestamp}\n${nonce}\n${secret}`;
      const sign = await hmac("sha256", stringToSign, secret, "base64");
      url = `${webhook}&timestamp=${timestamp}&nonce=${nonce}&sign=${encodeURIComponent(sign)}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    return result.code === 0;
  } catch (error) {
    console.error("[Feishu] 发送失败:", error);
    return false;
  }
}

export function buildFeishuPost(coupons: {
  name: string;
  platform: string;
  expiryDate: string;
  daysLeft: number;
}[]): FeishuMessage {
  if (coupons.length === 0) {
    return {
      msg_type: "text",
      content: JSON.stringify({ text: "暂无即将过期的优惠券" }),
    };
  }

  const rows: string[][] = [];
  rows.push([
    `<font color="#1a1a1a"><b>🐑 优惠券即将过期提醒</b></font>`,
  ]);
  rows.push([
    `<font color="#666666">检测到 <b>${coupons.length}</b> 张优惠券即将过期，请及时使用！</font>`,
  ]);
  rows.push([""]);
  
  rows.push([
    `<table><tr><th>优惠券名称</th><th>平台</th><th>到期时间</th><th>剩余天数</th></tr>`,
  ]);

  coupons.forEach((c) => {
    const daysText = c.daysLeft === 0 
      ? `<b><font color="#ff4d4f">今天过期</font></b>` 
      : c.daysLeft === 1 
        ? `<b><font color="#faad14">明天过期</font></b>` 
        : `剩 ${c.daysLeft} 天`;
    rows.push([
      `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.platform)}</td><td>${c.expiryDate}</td><td>${daysText}</td></tr>`,
    ]);
  });

  rows.push(["</table>"]);
  rows.push([""]);
  rows.push([`<font color="#fa8c16">请尽快使用，避免浪费！💰</font>`]);

  return {
    msg_type: "post",
    post: {
      zh_cn: {
        title: "优惠券即将过期提醒",
        content: rows,
      },
    },
  };
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}