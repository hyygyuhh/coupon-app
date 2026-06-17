import { useState, useMemo } from "react";
import { CheckSquare, Square, Trash2, Tag, Filter } from "lucide-react";
import type { Coupon } from "../types/coupon";
import { daysUntil } from "../utils/date";

interface Props {
  coupons: Coupon[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBatchDelete: () => void;
  onBatchMarkUsed: () => void;
  onBatchAddTag: (tag: string) => void;
}

export default function BatchActions({
  coupons,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBatchDelete,
  onBatchMarkUsed,
  onBatchAddTag,
}: Props) {
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const selectedCoupons = useMemo(
    () => coupons.filter((c) => selectedIds.includes(c.id)),
    [coupons, selectedIds]
  );

  const canMarkUsed = selectedCoupons.some((c) => c.status !== "used");
  const hasUnused = selectedCoupons.some((c) => c.status === "unused");

  const handleAddTag = () => {
    if (tagInput.trim()) {
      onBatchAddTag(tagInput.trim());
      setTagInput("");
      setShowTagInput(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSelectAll}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition ${
              selectedIds.length === coupons.length && coupons.length > 0
                ? "bg-accent-ink text-white"
                : "bg-white text-accent-ink border border-accent-orangeLight/50"
            }`}
          >
            {selectedIds.length === coupons.length && coupons.length > 0 ? (
              <CheckSquare size={16} />
            ) : (
              <Square size={16} />
            )}
            全选
          </button>
          {selectedIds.length > 0 && (
            <span className="text-sm text-accent-inkMute">
              已选择 <b>{selectedIds.length}</b> 张券
            </span>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            {showTagInput ? (
              <div className="flex items-center gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  placeholder="输入标签..."
                  className="px-3 py-1.5 rounded-full text-sm border border-accent-orangeLight/50 focus:border-accent-orange outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-accent-orange text-white hover:bg-accent-orange/90 transition"
                >
                  添加
                </button>
                <button
                  type="button"
                  onClick={() => setShowTagInput(false)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-paper text-accent-ink hover:bg-accent-orangeLight/40 transition"
                >
                  取消
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onBatchMarkUsed}
                  disabled={!canMarkUsed}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-accent-mint text-white hover:bg-accent-mint/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckSquare size={14} />
                  标记已用
                </button>
                <button
                  type="button"
                  onClick={() => setShowTagInput(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition"
                >
                  <Tag size={14} />
                  添加标签
                </button>
                <button
                  type="button"
                  onClick={onBatchDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-accent-red text-white hover:bg-accent-red/90 transition"
                >
                  <Trash2 size={14} />
                  删除
                </button>
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-paper text-accent-ink hover:bg-accent-orangeLight/40 transition"
                >
                  取消选择
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
