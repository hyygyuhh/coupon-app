import { hmac } from "./crypto";

export interface DingTalkMessage {
  msgtype: "text" | "markdown";
  text?: {
    content: string;
  };
  markdown?: {
    title: string;
    text: string;
  };
  at?: {
    atMobiles?: string[];
    isAtAll?: boolean;
  };
}

export async function sendDingTalkMessage(
  webhook: string,
  secret: string | undefined,
  message: DingTalkMessage
): Promise<boolean> {
  try {
    let url = webhook;
    
    if (secret) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${secret}`;
      const sign = hmac("sha256", stringToSign, secret, "base64");
      url = `${webhook}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    return result.errcode === 0;
  } catch (error) {
    console.error("[DingTalk] 发送失败:", error);
    return false;
  }
}

export function buildReminderMarkdown(coupons: {
  name: string;
  platform: string;
  expiryDate: string;
  daysLeft: number;
}[]): string {
  if (coupons.length === 0) return "";

  let markdown = `## 🐑 优惠券即将过期提醒\n\n`;
  markdown += `检测到 **${coupons.length}** 张优惠券即将过期，请及时使用！\n\n`;
  markdown += `| 优惠券名称 | 平台 | 到期时间 | 剩余天数 |\n`;
  markdown += `| --- | --- | --- | --- |\n`;

  coupons.forEach((c) => {
    const daysText = c.daysLeft === 0 ? "**今天过期**" : 
                     c.daysLeft === 1 ? "**明天过期**" : 
                     `剩 ${c.daysLeft} 天`;
    markdown += `| ${c.name} | ${c.platform} | ${c.expiryDate} | ${daysText} |\n`;
  });

  markdown += `\n请尽快使用，避免浪费！💰`;
  return markdown;
}