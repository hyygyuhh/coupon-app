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
      content: JSON.stringify({ text: "🐑 羊毛管家提醒：暂无即将过期的优惠券" }),
    };
  }

  let text = `🐑 羊毛管家提醒：检测到 ${coupons.length} 张优惠券即将过期！\n\n`;
  
  coupons.forEach((c) => {
    const daysText = c.daysLeft === 0 
      ? "今天过期" 
      : c.daysLeft === 1 
        ? "明天过期" 
        : `剩 ${c.daysLeft} 天`;
    text += `• ${c.name} (${c.platform}) - ${c.expiryDate} (${daysText})\n`;
  });
  
  text += "\n请尽快使用，避免浪费！💰";

  return {
    msg_type: "text",
    content: JSON.stringify({ text }),
  };
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}