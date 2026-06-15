import type { Coupon } from "../types/coupon";
import { daysUntil, formatDate } from "./date";
import { sendDingTalkMessage, buildReminderMarkdown } from "./dingtalk";
import { sendFeishuMessage, buildFeishuPost } from "./feishu";
import { loadConfig, saveConfig } from "./storage";

export type ReminderType = "dingtalk" | "feishu";

export type ReminderTimeSlot = "morning" | "afternoon" | "evening" | "any";

export interface ReminderConfig {
  enabled: boolean;
  type: ReminderType;
  webhook: string;
  secret: string;
  reminderDays: number;
  lastReminderTime: number;
  testMode: boolean;
  timeSlot: ReminderTimeSlot;
  dailyReminder: boolean;
  dailyReminderHour: number;
}

export const DEFAULT_CONFIG: ReminderConfig = {
  enabled: false,
  type: "dingtalk",
  webhook: "",
  secret: "",
  reminderDays: 3,
  lastReminderTime: 0,
  testMode: false,
  timeSlot: "morning",
  dailyReminder: true,
  dailyReminderHour: 9,
};

export function getReminderConfig(): ReminderConfig {
  const config = loadConfig<ReminderConfig>("reminder-config");
  return { ...DEFAULT_CONFIG, ...config };
}

export function saveReminderConfig(config: ReminderConfig): void {
  saveConfig("reminder-config", config);
}

export interface ExpiringCouponInfo {
  name: string;
  platform: string;
  expiryDate: string;
  daysLeft: number;
  coupon: Coupon;
}

export function getExpiringCoupons(
  coupons: Coupon[],
  days: number = 3
): ExpiringCouponInfo[] {
  return coupons
    .filter((c) => {
      if (c.status !== "unused") return false;
      const d = daysUntil(c.expiryDate);
      return d >= 0 && d <= days;
    })
    .map((c) => ({
      name: c.name,
      platform: c.platform,
      expiryDate: c.expiryDate,
      daysLeft: daysUntil(c.expiryDate),
      coupon: c,
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function shouldSendReminderNow(config: ReminderConfig): boolean {
  const now = new Date();
  const currentHour = now.getHours();

  switch (config.timeSlot) {
    case "morning":
      return currentHour >= 7 && currentHour < 12;
    case "afternoon":
      return currentHour >= 12 && currentHour < 18;
    case "evening":
      return currentHour >= 18 && currentHour < 23;
    case "any":
    default:
      return true;
  }
}

export function getTodayReminderKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function getNextReminderTime(config: ReminderConfig): number {
  const now = new Date();
  const targetHour = config.dailyReminderHour;
  
  const nextReminder = new Date();
  nextReminder.setHours(targetHour, 0, 0, 0);
  
  if (nextReminder.getTime() <= now.getTime()) {
    nextReminder.setDate(nextReminder.getDate() + 1);
  }
  
  return nextReminder.getTime();
}

export function hasCouponBeenRemindedToday(couponId: string): boolean {
  const todayKey = getTodayReminderKey();
  const remindedCoupons = loadConfig<string[]>("reminded-coupons-" + todayKey) || [];
  return remindedCoupons.includes(couponId);
}

export function markCouponAsRemindedToday(couponId: string): void {
  const todayKey = getTodayReminderKey();
  const remindedCoupons = loadConfig<string[]>("reminded-coupons-" + todayKey) || [];
  if (!remindedCoupons.includes(couponId)) {
    remindedCoupons.push(couponId);
    saveConfig("reminded-coupons-" + todayKey, remindedCoupons);
  }
}

export function clearOldReminderRecords(): void {
  const todayKey = getTodayReminderKey();
  const allKeys = Object.keys(localStorage);
  allKeys.forEach((key) => {
    if (key.startsWith("reminded-coupons-") && key !== "reminded-coupons-" + todayKey) {
      localStorage.removeItem(key);
    }
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

  clearOldReminderRecords();

  const expiring = getExpiringCoupons(coupons, reminderConfig.reminderDays);
  
  if (expiring.length === 0) {
    return false;
  }

  const needReminder = expiring.filter((c) => {
    return !hasCouponBeenRemindedToday(c.coupon.id);
  });

  if (needReminder.length === 0) {
    return false;
  }

  if (!shouldSendReminderNow(reminderConfig)) {
    return false;
  }

  const reminderData = needReminder.map((c) => ({
    name: c.name,
    platform: c.platform,
    expiryDate: c.expiryDate,
    daysLeft: c.daysLeft,
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

  if (success && !reminderConfig.dailyReminder) {
    needReminder.forEach((c) => markCouponAsRemindedToday(c.coupon.id));
  }

  if (success) {
    const updatedConfig = { ...reminderConfig, lastReminderTime: Date.now() };
    saveReminderConfig(updatedConfig);
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
    daysLeft: c.daysLeft,
  }));

  if (reminderConfig.type === "dingtalk") {
    const markdown = buildReminderMarkdown(reminderData);
    return await sendDingTalkMessage(
      reminderConfig.webhook,
      reminderConfig.secret,
      {
        msgtype: "markdown",
        markdown: {
          title: "【测试】优惠券即将过期提醒",
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

export function scheduleDailyReminder(
  coupons: Coupon[],
  config?: ReminderConfig
): number | null {
  const reminderConfig = config || getReminderConfig();
  
  if (!reminderConfig.enabled || !reminderConfig.webhook) {
    return null;
  }

  const nextTime = getNextReminderTime(reminderConfig);
  const delay = nextTime - Date.now();

  if (delay <= 0) {
    return null;
  }

  const timer = window.setTimeout(async () => {
    await sendReminderIfNeeded(coupons, reminderConfig);
  }, delay);

  return timer;
}