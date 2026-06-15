import { useEffect, useMemo, useState } from "react";
import NavBar from "./components/NavBar";
import HeroSection from "./components/HeroSection";
import CouponList from "./components/CouponList";
import EmptyState from "./components/EmptyState";
import CouponModal from "./components/CouponModal";
import ReminderSettings from "./components/ReminderSettings";
import { useCouponStore } from "./store/couponStore";
import type { Coupon, CouponInput } from "./types/coupon";
import { daysUntil } from "./utils/date";
import { preloadOCR } from "./utils/ocrService";
import { sendReminderIfNeeded } from "./utils/reminder";
import { REMINDER_DELAY_MS, EXPIRED_REFRESH_INTERVAL_MS, OCR_PRELOAD_DELAY_MS } from "./utils/constants";

type View = "home" | "settings";

export default function App() {
  const {
    coupons,
    addCoupon,
    updateCoupon,
    markUsed,
    markUnused,
    removeCoupon,
    refreshExpired,
  } = useCouponStore();

  const [view, setView] = useState<View>("home");

  useEffect(() => {
    refreshExpired();
    const timer = window.setInterval(refreshExpired, EXPIRED_REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshExpired();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshExpired]);

  useEffect(() => {
    const timer = setTimeout(() => {
      preloadOCR((progress, status) => {
        console.log(`OCR 预加载: ${(progress * 100).toFixed(0)}% - ${status}`);
      });
    }, OCR_PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      await sendReminderIfNeeded(coupons);
    }, REMINDER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [coupons]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Coupon | null>(null);

  useEffect(() => {
    if (pendingDelete || modalOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [pendingDelete, modalOpen]);

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
    setPendingDelete(c);
  };
  const confirmDelete = () => {
    if (pendingDelete) {
      removeCoupon(pendingDelete.id);
      setPendingDelete(null);
    }
  };
  const cancelDelete = () => {
    setPendingDelete(null);
  };

  if (view === "settings") {
    return (
      <div className="min-h-screen text-accent-ink">
        <NavBar 
          onAdd={openAdd} 
          onSettings={() => setView("home")}
          onHome={() => setView("home")}
          isHome={false}
        />
        <ReminderSettings />
        <footer className="text-center pb-8 text-xs text-accent-inkMute">
          🐑 羊毛管家 · 数据保存在你的浏览器本地
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-accent-ink">
      <NavBar 
        onAdd={openAdd} 
        onSettings={() => setView("settings")}
        onHome={() => setView("home")}
        isHome={true}
      />
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

      {pendingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-accent-ink/40 backdrop-blur-sm animate-floatUp"
          onClick={cancelDelete}
        >
          <div
            className="relative bg-cream rounded-3xl shadow-cardHover w-full max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="font-display text-xl font-bold text-accent-ink mb-1">
              确认删除这张券？
            </h3>
            <p className="text-sm text-accent-inkMute mb-5 break-all">
              「{pendingDelete.name}」删除后无法恢复
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={cancelDelete}
                className="px-5 py-2 rounded-full font-bold text-accent-ink bg-paper hover:bg-accent-orangeLight/60 transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-5 py-2 rounded-full font-bold text-white bg-accent-red hover:bg-accent-red/90 shadow-card transition active:scale-95"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center pb-8 text-xs text-accent-inkMute">
        🐑 羊毛管家 · 数据保存在你的浏览器本地
      </footer>
    </div>
  );
}
