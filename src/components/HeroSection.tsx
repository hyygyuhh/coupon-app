import { TrendingUp, TrendingDown, Clock, AlertCircle } from "lucide-react";
import StatsPill from "./StatsPill";

interface Props {
  total: number;
  soon: number;
  unused: number;
  used: number;
  expired: number;
}

export default function HeroSection({ total, soon, unused, used, expired }: Props) {
  const usageRate = total > 0 ? Math.round((used / total) * 100) : 0;
  const wasteRate = total > 0 ? Math.round((expired / total) * 100) : 0;

  return (
    <section className="relative overflow-hidden">
      {/* 背景光晕 */}
      <div className="pointer-events-none absolute -top-20 -left-20 w-80 h-80 bg-accent-orangeLight/40 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute top-10 right-0 w-96 h-96 bg-accent-mintLight/40 rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-sm text-accent-inkMute mb-1">
              Hi ~ 这里是你的
            </p>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-accent-ink leading-tight">
              羊毛 <span className="text-accent-orange">小仓库</span>
            </h2>
            <p className="mt-2 text-sm text-accent-inkMute max-w-md">
              按过期时间自动排列，最紧急的券放在最前面，再也不错过薅羊毛机会 🐏
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 animate-floatUp mb-6">
          <StatsPill label="全部" color="ink" value={total} />
          <StatsPill label="即将过期" color="orange" value={soon} />
          <StatsPill label="可用" color="mint" value={unused} />
          <StatsPill label="已用" color="orange" value={used} />
          <StatsPill label="已过期" color="red" value={expired} />
        </div>

        {/* 统计分析面板 */}
        {total > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-floatUp">
            {/* 使用效率卡片 */}
            <div className="bg-white rounded-3xl p-5 shadow-card border border-accent-grayLight/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-accent-mint/20 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-accent-mint" />
                  </div>
                  <span className="font-bold text-accent-ink">使用效率</span>
                </div>
                <span className={`text-xl font-bold font-display ${
                  usageRate >= 50 ? "text-accent-mint" : usageRate >= 30 ? "text-accent-orange" : "text-accent-red"
                }`}>
                  {usageRate}%
                </span>
              </div>
              <div className="h-2 bg-paper rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    usageRate >= 50 ? "bg-accent-mint" : usageRate >= 30 ? "bg-accent-orange" : "bg-accent-red"
                  }`}
                  style={{ width: `${usageRate}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-accent-inkMute">
                <span>已使用 {used} 张</span>
                <span>共 {total} 张</span>
              </div>
            </div>

            {/* 过期浪费卡片 */}
            <div className="bg-white rounded-3xl p-5 shadow-card border border-accent-grayLight/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-accent-red/20 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 text-accent-red" />
                  </div>
                  <span className="font-bold text-accent-ink">过期浪费</span>
                </div>
                <span className={`text-xl font-bold font-display ${
                  wasteRate === 0 ? "text-accent-mint" : wasteRate <= 10 ? "text-accent-orange" : "text-accent-red"
                }`}>
                  {wasteRate}%
                </span>
              </div>
              <div className="h-2 bg-paper rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    wasteRate === 0 ? "bg-accent-mint" : wasteRate <= 10 ? "bg-accent-orange" : "bg-accent-red"
                  }`}
                  style={{ width: `${wasteRate}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-accent-inkMute">
                <span>已过期 {expired} 张</span>
                <span>共 {total} 张</span>
              </div>
            </div>
          </div>
        )}

        {/* 警告提示 */}
        {soon > 0 && (
          <div className="mt-4 flex items-center gap-3 p-4 bg-accent-orange/10 rounded-2xl border border-accent-orange/30 animate-floatUp">
            <AlertCircle className="w-5 h-5 text-accent-orange flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-accent-orange text-sm">
                注意！有 {soon} 张券即将过期
              </p>
              <p className="text-xs text-accent-inkMute mt-0.5">
                请尽快使用这些优惠券，以免浪费
              </p>
            </div>
          </div>
        )}

        {/* 空状态提示 */}
        {total === 0 && (
          <div className="mt-4 flex items-center gap-3 p-4 bg-accent-mint/10 rounded-2xl border border-accent-mint/30 animate-floatUp">
            <Clock className="w-5 h-5 text-accent-mint flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-accent-mint text-sm">
                暂无优惠券
              </p>
              <p className="text-xs text-accent-inkMute mt-0.5">
                点击右上角「添加券」开始记录你的第一张优惠券吧
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
