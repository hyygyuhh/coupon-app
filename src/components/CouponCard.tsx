import { Check, Copy, Edit3, ExternalLink, Trash2, Square } from "lucide-react";
import { useState } from "react";
import type { Coupon } from "../types/coupon";
import {
  daysUntil,
  formatDate,
  humanDaysLeft,
  isSoon,
} from "../utils/date";

interface Props {
  coupon: Coupon;
  onEdit: (c: Coupon) => void;
  onToggleUsed: (c: Coupon) => void;
  onDelete: (c: Coupon) => void;
  selected?: boolean;
  onSelect?: () => void;
}

export default function CouponCard({
  coupon,
  onEdit,
  onToggleUsed,
  onDelete,
  selected = false,
  onSelect,
}: Props) {
  const days = daysUntil(coupon.expiryDate);
  const urgent = coupon.status === "unused" && isSoon(coupon.expiryDate);
  const expired = coupon.status === "expired";
  const used = coupon.status === "used";
  const [copied, setCopied] = useState(false);

  const borderColor = expired
    ? "border-accent-red/40 dark:border-accent-red/30"
    : used
    ? "border-accent-mintLight dark:border-accent-mint/30"
    : urgent
    ? "border-2 border-accent-orange dark:border-accent-orange"
    : "border border-accent-orangeLight/50 dark:border-white/10";

  const copyCode = () => {
    if (!coupon.code) return;
    navigator.clipboard?.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className={`coupon-card ${borderColor} shadow-card hover:shadow-cardHover transition-all duration-300 hover:-translate-y-1 animate-floatUp ${
        selected ? "ring-2 ring-accent-orange" : ""
      }`}
      style={{ position: "relative" }}
    >
      {/* 选择复选框 */}
      {onSelect && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition z-10 ${
            selected
              ? "bg-accent-orange text-white"
              : "bg-white/80 dark:bg-[#2d2d44]/80 text-accent-ink dark:text-white border border-accent-orangeLight/50 dark:border-white/20 hover:border-accent-orange"
          }`}
        >
          {selected ? <Check size={14} strokeWidth={3} /> : <Square size={14} />}
        </button>
      )}

      <div className="flex items-stretch">
        {/* 左侧：金额 / 主色 */}
        <div
          className={`w-28 sm:w-32 flex-shrink-0 flex flex-col justify-center items-center py-5 px-3 transition-colors ${
            expired
              ? "bg-accent-red/10 dark:bg-accent-red/20 text-accent-red"
              : used
              ? "bg-accent-mintLight/30 dark:bg-accent-mint/20 text-accent-mint"
              : urgent
              ? "bg-accent-orange/15 dark:bg-accent-orange/20 text-accent-orange"
              : "bg-accent-orangeLight/20 dark:bg-accent-orange/15 text-accent-orange"
          }`}
        >
          <span className="text-[11px] uppercase tracking-wider opacity-70">
            {coupon.platform || "平台"}
          </span>
          <span className="font-display text-2xl sm:text-3xl font-extrabold leading-tight mt-1 text-center break-all">
            {coupon.amount || "券"}
          </span>
          <div className="mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70 dark:bg-white/20 transition-colors">
            {expired
              ? "已过期"
              : used
              ? "已使用"
              : urgent
              ? humanDaysLeft(days)
              : humanDaysLeft(days)}
          </div>
        </div>

        {/* 虚线分隔 */}
        <div className="border-l-2 border-dashed border-accent-inkMute/20 dark:border-white/10" />

        {/* 右侧：内容 */}
        <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between min-w-0 pr-10">
          <div>
            <h3 className="font-display text-lg font-bold text-accent-ink dark:text-white truncate transition-colors">
              {coupon.name}
            </h3>
            <p className="text-xs text-accent-inkMute dark:text-gray-400 mt-1 transition-colors">
              到期 {formatDate(coupon.expiryDate)}
            </p>

            {coupon.code && (
              <button
                type="button"
                onClick={copyCode}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-accent-ink dark:text-white bg-paper dark:bg-[#252538] hover:bg-accent-orangeLight/30 dark:hover:bg-white/10 px-2.5 py-1 rounded-lg transition"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span className="tracking-wider">{coupon.code}</span>
                <span className="opacity-60">{copied ? "已复制" : "复制"}</span>
              </button>
            )}

            {coupon.tags && coupon.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {coupon.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] bg-accent-mintLight/40 dark:bg-accent-mint/20 text-accent-mint px-2 py-0.5 rounded-full font-bold transition-colors"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {coupon.note && (
              <p className="text-xs text-accent-inkMute dark:text-gray-400 mt-3 line-clamp-2 transition-colors">
                📝 {coupon.note}
              </p>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {coupon.url && (
              <a
                href={coupon.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 text-xs sm:text-sm font-bold text-accent-ink dark:text-white bg-accent-mintLight/40 dark:bg-accent-mint/20 hover:bg-accent-mintLight dark:hover:bg-accent-mint/30 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg transition min-h-[44px] sm:min-h-auto"
              >
                <ExternalLink className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> 去使用
              </a>
            )}
            <button
              type="button"
              onClick={() => onToggleUsed(coupon)}
              className={`inline-flex items-center justify-center gap-1 text-xs sm:text-sm font-bold px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg transition min-h-[44px] sm:min-h-auto ${
                used
                  ? "bg-accent-inkMute/20 dark:bg-white/10 text-accent-ink dark:text-white hover:bg-accent-inkMute/30 dark:hover:bg-white/20"
                  : "bg-accent-mint text-white hover:bg-accent-mint/90"
              }`}
            >
              <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> {used ? "取消已用" : "标记已用"}
            </button>
            <button
              type="button"
              onClick={() => onEdit(coupon)}
              className="inline-flex items-center justify-center gap-1 text-xs sm:text-sm font-bold text-accent-ink dark:text-white bg-paper dark:bg-[#252538] hover:bg-accent-orangeLight/40 dark:hover:bg-white/10 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg transition min-h-[44px] sm:min-h-auto"
            >
              <Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> 编辑
            </button>
            <button
              type="button"
              onClick={() => onDelete(coupon)}
              className="inline-flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto text-xs sm:text-sm font-bold text-accent-red bg-accent-redLight/30 dark:bg-accent-red/20 hover:bg-accent-redLight/60 dark:hover:bg-accent-red/30 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg transition"
            >
              <Trash2 className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
