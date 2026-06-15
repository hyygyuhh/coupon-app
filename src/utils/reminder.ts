import type { Coupon } from "../types/coupon";
import { daysUntil } from "./date";
import { sendDingTalkMessage, buildReminderMarkdown } from "./dingtalk";
import { loadConfig, saveConfig } from "./storage";

export interface ReminderConfig {
  enabled: boolean;
  webhook: string;
  secret: string;
  reminderDays: number;
  lastReminderTime: number;
}

export const DEFAULT_CONFIG: ReminderConfig = {
  enabled: false,
  webhook: "",
  secret: "",
  reminderDays: 3,
  lastReminderTime: 0,
};

export function getReminderConfig(): ReminderConfig {
  const config = loadConfig<ReminderConfig>("dingtalk-config");
  return { ...DEFAULT_CONFIG, ...config };
}

export function saveReminderConfig(config: ReminderConfig): void {
  saveConfig("dingtalk-config", config);
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
  
  if (now - lastTime < oneDay) {
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

  const markdown = buildReminderMarkdown(reminderData);
  
  const success = await sendDingTalkMessage(
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

  if (success) {
    saveReminderConfig({
      ...reminderConfig,
      lastReminderTime: now,
    });
  }

  return success;
}