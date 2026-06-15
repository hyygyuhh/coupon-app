import type { Coupon } from "../types/coupon";
import { daysUntil } from "./date";
import { sendDingTalkMessage, buildReminderMarkdown } from "./dingtalk";
import { sendFeishuMessage, buildFeishuPost } from "./feishu";
import { loadConfig, saveConfig } from "./storage";

export type ReminderType = "dingtalk" | "feishu";

export interface ReminderConfig {
  enabled: boolean;
  type: ReminderType;
  webhook: string;
  secret: string;
  reminderDays: number;
  lastReminderTime: number;
  testMode: boolean;
}

export const DEFAULT_CONFIG: ReminderConfig = {
  enabled: false,
  type: "dingtalk",
  webhook: "",
  secret: "",
  reminderDays: 3,
  lastReminderTime: 0,
  testMode: false,
};

export function getReminderConfig(): ReminderConfig {
  const config = loadConfig<ReminderConfig>("reminder-config");
  return { ...DEFAULT_CONFIG, ...config };
}

export function saveReminderConfig(config: ReminderConfig): void {
  saveConfig("reminder-config", config);
}

export function getExpiringCoupons(
  coupons: Coupon[],
  days: number = 3
): Coupon[] {
  return coupons.filter((c) => {
    if (c.status !== "unused") return false;
    const d = daysUntil(c.expiryDate);
    return d >= 0 && d <= days;
  });
}

export async function sendReminderIfNeeded(
  coupons: Coupon[],
  config?: ReminderConfig
): Promise<boolean> {
  const reminderConfig = config || getReminderConfig();
  
  if (!reminderConfig.enabled || !reminderConfig.webhook) {
    return false;
  }

  const now = Date.now();
  const lastTime = reminderConfig.lastReminderTime;
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (!reminderConfig.testMode && now - lastTime < oneDay) {
    return false;
  }

  const expiring = getExpiringCoupons(coupons, reminderConfig.reminderDays);
  
  if (expiring.length === 0) {
    return false;
  }

  const reminderData = expiring.map((c) => ({
    name: c.name,
    platform: c.platform,
    expiryDate: c.expiryDate,
    daysLeft: daysUntil(c.expiryDate),
  }));

  let success = false;

  if (reminderConfig.type === "dingtalk") {
    const markdown = buildReminderMarkdown(reminderData);
    success = await sendDingTalkMessage(
      reminderConfig.webhook,
      reminderConfig.secret,
      {
        msgtype: "markdown",
        markdown: {
          title: "优惠券即将过期提醒",
          text: markdown,
        },
      }
    );
  } else if (reminderConfig.type === "feishu") {
    const post = buildFeishuPost(reminderData);
    success = await sendFeishuMessage(
      reminderConfig.webhook,
      reminderConfig.secret,
      post
    );
  }

  if (success) {
    saveReminderConfig({
      ...reminderConfig,
      lastReminderTime: now,
    });
  }

  return success;
}

export async function sendTestReminder(
  coupons: Coupon[],
  config?: ReminderConfig
): Promise<boolean> {
  const reminderConfig = config || getReminderConfig();
  
  if (!reminderConfig.webhook) {
    return false;
  }

  const expiring = getExpiringCoupons(coupons, reminderConfig.reminderDays);
  
  if (expiring.length === 0) {
    return false;
  }

  const reminderData = expiring.map((c) => ({
    name: c.name,
    platform: c.platform,
    expiryDate: c.expiryDate,
    daysLeft: daysUntil(c.expiryDate),
  }));

  if (reminderConfig.type === "dingtalk") {
    const markdown = buildReminderMarkdown(reminderData);
    return await sendDingTalkMessage(
      reminderConfig.webhook,
      reminderConfig.secret,
      {
        msgtype: "markdown",
        markdown: {
          title: "优惠券即将过期提醒",
          text: markdown,
        },
      }
    );
  } else if (reminderConfig.type === "feishu") {
    const post = buildFeishuPost(reminderData);
    return await sendFeishuMessage(
      reminderConfig.webhook,
      reminderConfig.secret,
      post
    );
  }

  return false;
}

export async function testReminder(config: ReminderConfig): Promise<boolean> {
  if (!config.webhook) return false;

  if (config.type === "dingtalk") {
    return await sendDingTalkMessage(config.webhook, config.secret, {
      msgtype: "text",
      text: { content: "🐑 羊毛管家测试消息：提醒功能配置成功！" },
    });
  } else if (config.type === "feishu") {
    return await sendFeishuMessage(config.webhook, config.secret, {
      msg_type: "text",
      content: JSON.stringify({ text: "🐑 羊毛管家测试消息：提醒功能配置成功！" }),
    });
  }

  return false;
}