import { useMemo, useState } from "react";
import NavBar from "./components/NavBar";
import HeroSection from "./components/HeroSection";
import CouponList from "./components/CouponList";
import EmptyState from "./components/EmptyState";
import CouponModal from "./components/CouponModal";
import { useCouponStore } from "./store/couponStore";
import type { Coupon, CouponInput } from "./types/coupon";
import { daysUntil } from "./utils/date";

export default function App() {
  const {
    coupons,
    addCoupon,
    updateCoupon,
    markUsed,
    markUnused,
    removeCoupon,
  } = useCouponStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  const stats = useMemo(() => {
    const total = coupons.length;
    const unused = coupons.filter((c) => c.status === "unused").length;
    const used = coupons.filter((c) => c.status === "used").length;
    const expired = coupons.filter((c) => c.status === "expired").length;
    const soon = coupons.filter(
      (c) => {
        const d = daysUntil(c.expiryDate);
        return c.status === "unused" && d >= 0 && d <= 3;
      }
    ).length;
    return { total, unused, used, expired, soon };
  }, [coupons]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setModalOpen(true);
  };
  const onSave = (input: CouponInput, id?: string) => {
    if (id) updateCoupon(id, input);
    else addCoupon(input);
    setModalOpen(false);
    setEditing(null);
  };
  const toggleUsed = (c: Coupon) => {
    if (c.status === "used") markUnused(c.id);
    else markUsed(c.id);
  };
  const onDelete = (c: Coupon) => {
    if (confirm(`确定删除「${c.name}」？`)) removeCoupon(c.id);
  };

  return (
    <div className="min-h-screen text-accent-ink">
      <NavBar onAdd={openAdd} />
      <HeroSection
        total={stats.total}
        soon={stats.soon}
        unused={stats.unused}
        used={stats.used}
        expired={stats.expired}
      />
      {coupons.length === 0 ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <EmptyState onAdd={openAdd} />
        </div>
      ) : (
        <CouponList
          coupons={coupons}
          onEdit={openEdit}
          onToggleUsed={toggleUsed}
          onDelete={onDelete}
        />
      )}
      <CouponModal
        open={modalOpen}
        coupon={editing}
        onClose={() => setModalOpen(false)}
        onSave={onSave}
      />
      <footer className="text-center pb-8 text-xs text-accent-inkMute">
        🐑 羊毛管家 · 数据保存在你的浏览器本地
      </footer>
    </div>
  );
}
