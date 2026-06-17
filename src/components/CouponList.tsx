import { useState, useMemo } from "react";
import { Search, Filter, TrendingUp } from "lucide-react";
import type { Coupon, CouponStatus } from "../types/coupon";
import { daysUntil } from "../utils/date";
import CouponCard from "./CouponCard";
import BatchActions from "./BatchActions";
import { showToast } from "./Toast";

interface Props {
  coupons: Coupon[];
  onEdit: (c: Coupon) => void;
  onToggleUsed: (c: Coupon) => void;
  onDelete: (c: Coupon) => void;
  onBatchDelete: (ids: string[]) => void;
  onBatchMarkUsed: (ids: string[]) => void;
  onBatchAddTag: (ids: string[], tag: string) => void;
}

type Filter = "all" | CouponStatus | "soon";

const tabs: { key: Filter; label: string; color: string }[] = [
  { key: "all", label: "全部", color: "ink" },
  { key: "soon", label: "即将过期", color: "orange" },
  { key: "unused", label: "可用", color: "mint" },
  { key: "used", label: "已使用", color: "orange" },
  { key: "expired", label: "已过期", color: "red" },
];

const tabBg: Record<Filter, string> = {
  all: "bg-accent-ink text-white",
  soon: "bg-accent-orange text-white",
  unused: "bg-accent-mint text-white",
  used: "bg-accent-orange text-white",
  expired: "bg-accent-red text-white",
};
const tabInactive =
  "bg-white text-accent-ink border border-accent-orangeLight/50";

export default function CouponList({
  coupons,
  onEdit,
  onToggleUsed,
  onDelete,
  onBatchDelete,
  onBatchMarkUsed,
  onBatchAddTag,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [keyword, setKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    let list = coupons;
    if (filter === "soon") {
      list = list.filter(
        (c) => {
          const d = daysUntil(c.expiryDate);
          return c.status === "unused" && d >= 0 && d <= 3;
        }
      );
    } else if (filter !== "all") {
      list = list.filter((c) => c.status === filter);
    }
    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(k) ||
          c.platform.toLowerCase().includes(k) ||
          (c.code || "").toLowerCase().includes(k) ||
          (c.tags || []).some((t) => t.toLowerCase().includes(k))
      );
    }
    return [...list].sort((a, b) => {
      const weight = (c: Coupon) =>
        c.status === "unused" ? 0 : c.status === "used" ? 1 : 2;
      if (weight(a) !== weight(b)) return weight(a) - weight(b);
      if (a.status === "unused" && b.status === "unused") {
        return a.expiryDate.localeCompare(b.expiryDate);
      }
      return (b.updatedAt || b.createdAt).localeCompare(
        a.updatedAt || a.createdAt
      );
    });
  }, [coupons, filter, keyword]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((c) => c.id));
    }
  };

  const handleBatchDelete = () => {
    onBatchDelete(selectedIds);
    setSelectedIds([]);
    showToast("success", `已删除 ${selectedIds.length} 张券`);
  };

  const handleBatchMarkUsed = () => {
    onBatchMarkUsed(selectedIds);
    setSelectedIds([]);
    showToast("success", `已标记 ${selectedIds.length} 张券为已使用`);
  };

  const handleBatchAddTag = (tag: string) => {
    onBatchAddTag(selectedIds, tag);
    showToast("success", `已为 ${selectedIds.length} 张券添加标签「${tag}」`);
  };

  const groupedByPlatform = useMemo(() => {
    if (filter === "all") {
      const groups: Record<string, Coupon[]> = {};
      filtered.forEach((c) => {
        const key = c.platform || "未分类";
        groups[key] = groups[key] || [];
        groups[key].push(c);
      });
      return groups;
    }
    return { 全部: filtered };
  }, [filtered, filter]);

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
      {/* 筛选 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
                filter === t.key ? tabBg[t.key] : tabInactive
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto flex-1 max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-inkMute"
          />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索名称、平台、标签..."
            className="w-full pl-9 pr-3 py-2 rounded-full bg-white border border-accent-orangeLight/50 text-sm outline-none focus:border-accent-orange transition"
          />
        </div>
      </div>

      {/* 批量操作 */}
      {filtered.length > 0 && (
        <BatchActions
          coupons={filtered}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onClearSelection={() => setSelectedIds([])}
          onBatchDelete={handleBatchDelete}
          onBatchMarkUsed={handleBatchMarkUsed}
          onBatchAddTag={handleBatchAddTag}
        />
      )}

      {/* 卡片网格 */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-accent-inkMute animate-floatUp">
          <div className="text-5xl mb-3">🍂</div>
          这里空空的，换个筛选条件看看？
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByPlatform).map(([platform, items]) => (
            <div key={platform}>
              <div className="flex items-center gap-2 mb-3">
                <Filter size={14} className="text-accent-inkMute" />
                <span className="text-sm font-medium text-accent-inkMute">
                  {platform} ({items.length})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((c) => (
                  <CouponCard
                    key={c.id}
                    coupon={c}
                    onEdit={onEdit}
                    onToggleUsed={onToggleUsed}
                    onDelete={onDelete}
                    selected={selectedIds.includes(c.id)}
                    onSelect={() => toggleSelect(c.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
