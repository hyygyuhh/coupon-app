import { Plus, Settings } from "lucide-react";
import LogoIcon from "./LogoIcon";

interface Props {
  onAdd: () => void;
  onSettings: () => void;
  onHome?: () => void;
  isHome?: boolean;
}

export default function NavBar({ onAdd, onSettings, onHome, isHome }: Props) {
  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-cream/80 border-b border-accent-orangeLight/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <button
          onClick={onHome}
          disabled={isHome || !onHome}
          className={`flex items-center gap-3 transition-all duration-200 ${
            isHome || !onHome
              ? "cursor-default"
              : "cursor-pointer hover:scale-102 active:scale-98"
          }`}
        >
          <LogoIcon className="w-10 h-10 shadow-card" />
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-accent-ink">
              羊毛管家
            </h1>
            <p className="text-xs text-accent-inkMute">
              你的优惠券小助手
            </p>
          </div>
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSettings}
            className="p-2 text-accent-inkMute hover:text-accent-orange hover:bg-accent-orangeLight/30 rounded-full transition"
          >
            <Settings size={20} />
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-2 bg-accent-orange hover:bg-accent-orange/90 text-white px-4 py-2 rounded-full font-bold shadow-card hover:shadow-cardHover transition active:scale-95"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">添加券</span>
          </button>
        </div>
      </div>
    </header>
  );
}
