import StatsPill from "./StatsPill";

interface Props {
  total: number;
  soon: number;
  unused: number;
  used: number;
  expired: number;
}

export default function HeroSection({ total, soon, unused, used, expired }: Props) {
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

        <div className="flex flex-wrap gap-3 animate-floatUp">
          <StatsPill label="全部" color="ink" value={total} />
          <StatsPill label="即将过期" color="orange" value={soon} />
          <StatsPill label="可用" color="mint" value={unused} />
          <StatsPill label="已用" color="orange" value={used} />
          <StatsPill label="已过期" color="red" value={expired} />
        </div>
      </div>
    </section>
  );
}
