import { create } from "zustand";
import type { Coupon, CouponInput } from "../types/coupon";
import { loadCoupons, saveCoupons, uid } from "../utils/storage";
import { isExpired } from "../utils/date";

interface CouponState {
  coupons: Coupon[];
  addCoupon: (input: CouponInput) => void;
  updateCoupon: (id: string, input: CouponInput) => void;
  markUsed: (id: string) => void;
  markUnused: (id: string) => void;
  removeCoupon: (id: string) => void;
  refreshExpired: () => void;
}

function nowISO() {
  return new Date().toISOString();
}

export const useCouponStore = create<CouponState>((set, get) => {
  const initial = loadCoupons();
  // 启动时自动更新过期状态
  const normalized = initial.map((c) => {
    if (c.status === "unused" && isExpired(c.expiryDate)) {
      return { ...c, status: "expired" as const, updatedAt: nowISO() };
    }
    return c;
  });
  if (normalized.some((c, i) => c !== initial[i])) {
    saveCoupons(normalized);
  }

  return {
    coupons: normalized,

    addCoupon: (input) => {
      const now = nowISO();
      const newCoupon: Coupon = {
        id: uid(),
        name: input.name.trim(),
        platform: input.platform.trim(),
        code: input.code?.trim() || undefined,
        url: input.url?.trim() || undefined,
        amount: input.amount?.trim() || undefined,
        expiryDate: input.expiryDate,
        tags:
          input.tags
            ?.map((t) => t.trim())
            .filter(Boolean) || [],
        note: input.note?.trim() || undefined,
        status: "unused",
        createdAt: now,
        updatedAt: now,
      };
      const next = [newCoupon, ...get().coupons];
      saveCoupons(next);
      set({ coupons: next });
    },

    updateCoupon: (id, input) => {
      const next = get().coupons.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          name: input.name.trim(),
          platform: input.platform.trim(),
          code: input.code?.trim() || undefined,
          url: input.url?.trim() || undefined,
          amount: input.amount?.trim() || undefined,
          expiryDate: input.expiryDate,
          tags:
            input.tags
              ?.map((t) => t.trim())
              .filter(Boolean) || [],
          note: input.note?.trim() || undefined,
          status: (c.status === "used"
            ? "used"
            : isExpired(input.expiryDate)
            ? "expired"
            : "unused") as Coupon["status"],
          updatedAt: nowISO(),
        };
      });
      saveCoupons(next);
      set({ coupons: next });
    },

    markUsed: (id) => {
      const next = get().coupons.map((c) =>
        c.id === id ? { ...c, status: "used" as const, updatedAt: nowISO() } : c
      );
      saveCoupons(next);
      set({ coupons: next });
    },

    markUnused: (id) => {
      const next = get().coupons.map((c) =>
        c.id === id
          ? {
              ...c,
              status: (isExpired(c.expiryDate)
                ? "expired"
                : "unused") as Coupon["status"],
              updatedAt: nowISO(),
            }
          : c
      );
      saveCoupons(next);
      set({ coupons: next });
    },

    removeCoupon: (id) => {
      const next = get().coupons.filter((c) => c.id !== id);
      saveCoupons(next);
      set({ coupons: next });
    },

    refreshExpired: () => {
      const list = get().coupons;
      let changed = false;
      const next = list.map((c) => {
        if (c.status === "unused" && isExpired(c.expiryDate)) {
          changed = true;
          return { ...c, status: "expired" as const, updatedAt: nowISO() };
        }
        return c;
      });
      if (changed) {
        saveCoupons(next);
        set({ coupons: next });
      }
    },
  };
});
