import type { Coupon } from "../types/coupon";

const STORAGE_KEY = "wool-coupons";

export function loadCoupons(): Coupon[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c) =>
        c &&
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        typeof c.expiryDate === "string"
    ) as Coupon[];
  } catch (e) {
    console.warn("加载优惠券失败:", e);
    return [];
  }
}

export function saveCoupons(coupons: Coupon[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coupons));
  } catch (e) {
    console.warn("保存优惠券失败:", e);
  }
}

export function loadConfig<T>(key: string): Partial<T> {
  try {
    const raw = localStorage.getItem(`config-${key}`);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<T>;
  } catch (e) {
    console.warn(`加载配置 ${key} 失败:`, e);
    return {};
  }
}

export function saveConfig<T>(key: string, config: T): void {
  try {
    localStorage.setItem(`config-${key}`, JSON.stringify(config));
  } catch (e) {
    console.warn(`保存配置 ${key} 失败:`, e);
  }
}

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}
