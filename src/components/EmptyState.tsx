interface Props {
  onAdd: () => void;
}

export default function EmptyState({ onAdd }: Props) {
  return (
    <div className="flex flex-col items-center text-center py-16 animate-floatUp">
      <div className="text-7xl mb-4">🧺</div>
      <h3 className="font-display text-2xl font-bold text-accent-ink">
        还没有优惠券
      </h3>
      <p className="mt-2 text-sm text-accent-inkMute max-w-sm">
        把你抢到的优惠券都放在这里吧，管家会提醒你过期时间。
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 px-5 py-2.5 rounded-full bg-accent-orange text-white font-bold shadow-card hover:shadow-cardHover hover:-translate-y-0.5 transition"
      >
        + 添加第一张券
      </button>
    </div>
  );
}
