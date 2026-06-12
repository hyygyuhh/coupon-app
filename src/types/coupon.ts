export type CouponStatus = "unused" | "used" | "expired";

export interface Coupon {
  id: string;
  name: string;
  platform: string;
  code?: string;
  url?: string;
  amount?: string;
  expiryDate: string; // YYYY-MM-DD
  tags?: string[];
  note?: string;
  status: CouponStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CouponInput {
  name: string;
  platform: string;
  code?: string;
  url?: string;
  amount?: string;
  expiryDate: string;
  tags?: string[];
  note?: string;
}
