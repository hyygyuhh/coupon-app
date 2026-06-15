export const REMINDER_DELAY_MS = 5000;

export const EXPIRED_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export const DEFAULT_REMINDER_DAYS = 3;

export const MAX_REMINDER_DAYS = 30;

export const MIN_REMINDER_DAYS = 1;

export const OCR_PRELOAD_DELAY_MS = 1000;

export const SYNC_DELAY_MS = 3000;

export const STORAGE_KEYS = {
  COUPONS: "coupon-data",
  REMINDER_CONFIG: "reminder-config",
  THEME: "app-theme",
};

export const COUPON_STATUS = {
  UNUSED: "unused",
  USED: "used",
  EXPIRED: "expired",
} as const;

export const VALIDATION_MESSAGES = {
  REQUIRED: "此项为必填",
  INVALID_URL: "请输入有效的URL",
  INVALID_DATE: "请选择有效的日期",
} as const;

export const THEME = {
  LIGHT: "light",
  DARK: "dark",
} as const;