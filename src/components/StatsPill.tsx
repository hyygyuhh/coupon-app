interface StatsPillProps {
  label: string;
  value: number;
  color: "orange" | "mint" | "red" | "ink";
}

const colorMap = {
  orange: "bg-accent-orange text-white",
  mint: "bg-accent-mint text-white",
  red: "bg-accent-red text-white",
  ink: "bg-accent-ink text-white",
};

export default function StatsPill({ label, value, color }: StatsPillProps) {
  return (
    <div
      className={`${colorMap[color]} rounded-2xl px-4 py-3 shadow-card flex flex-col items-start min-w-[84px] transition hover:-translate-y-0.5`}
    >
      <span className="text-xs opacity-90">{label}</span>
      <span className="text-2xl font-bold font-display leading-none mt-1">
        {value}
      </span>
    </div>
  );
}
