import { Check, Copy, Edit3, ExternalLink, Trash2 } from "lucide-react";
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
}

export default function CouponCard({
  coupon,
  onEdit,
  onToggleUsed,
  onDelete,
}: Props) {
  const days = daysUntil(coupon.expiryDate);
  const urgent = coupon.status === "unused" && isSoon(coupon.expiryDate);
  const expired = coupon.status === "expired";
  const used = coupon.status === "used";
  const [copied, setCopied] = useState(false);

  const borderColor = expired
    ? "border-accent-red/40 bg-white"
    : used
    ? "border-accent-mintLight bg-white"
    : urgent
    ? "border-2 border-accent-orange bg-white"
    : "border border-accent-orangeLight/50 bg-white";

  const copyCode = () => {
    if (!coupon.code) return;
    navigator.clipboard?.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className={`coupon-card ${borderColor} shadow-card hover:shadow-cardHover transition-all duration-300 hover:-translate-y-1 animate-floatUp`}
      style={{ position: "relative" }}
    >
      <div className="flex items-stretch">
        {/* 左侧：金额 / 主色 */}
        <div
          className={`w-28 sm:w-32 flex-shrink-0 flex flex-col justify-center items-center py-5 px-3 ${
            expired
              ? "bg-accent-red/10 text-accent-red"
              : used
              ? "bg-accent-mintLight/30 text-accent-mint"
              : urgent
              ? "bg-accent-orange/15 text-accent-orange"
              : "bg-accent-orangeLight/20 text-accent-orange"
          }`}
        >
          <span className="text-[11px] uppercase tracking-wider opacity-70">
            {coupon.platform || "平台"}
          </span>
          <span className="font-display text-2xl sm:text-3xl font-extrabold leading-tight mt-1 text-center break-all">
            {coupon.amount || "券"}
          </span>
          <div className="mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70">
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
        <div className="border-l-2 border-dashed border-accent-inkMute/20" />

        {/* 右侧：内容 */}
        <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between min-w-0">
          <div>
            <h3 className="font-display text-lg font-bold text-accent-ink truncate">
              {coupon.name}
            </h3>
            <p className="text-xs text-accent-inkMute mt-1">
              到期 {formatDate(coupon.expiryDate)}
            </p>

            {coupon.code && (
              <button
                onClick={copyCode}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-accent-ink bg-paper hover:bg-accent-orangeLight/30 px-2.5 py-1 rounded-lg transition"
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
                    className="text-[11px] bg-accent-mintLight/40 text-accent-mint px-2 py-0.5 rounded-full font-bold"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {coupon.note && (
              <p className="text-xs text-accent-inkMute mt-3 line-clamp-2">
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
                className="inline-flex items-center gap-1 text-xs font-bold text-accent-ink bg-accent-mintLight/40 hover:bg-accent-mintLight px-2.5 py-1.5 rounded-lg transition"
              >
                <ExternalLink size={14} /> 去使用
              </a>
            )}
            <button
              onClick={() => onToggleUsed(coupon)}
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition ${
                used
                  ? "bg-accent-inkMute/20 text-accent-ink hover:bg-accent-inkMute/30"
                  : "bg-accent-mint text-white hover:bg-accent-mint/90"
              }`}
            >
              <Check size={14} /> {used ? "取消已用" : "标记已用"}
            </button>
            <button
              onClick={() => onEdit(coupon)}
              className="inline-flex items-center gap-1 text-xs font-bold text-accent-ink bg-paper hover:bg-accent-orangeLight/40 px-2.5 py-1.5 rounded-lg transition"
            >
              <Edit3 size={14} /> 编辑
            </button>
            <button
              onClick={() => onDelete(coupon)}
              className="inline-flex items-center gap-1 text-xs font-bold text-accent-red bg-accent-redLight/30 hover:bg-accent-redLight/60 px-2.5 py-1.5 rounded-lg transition ml-auto"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
