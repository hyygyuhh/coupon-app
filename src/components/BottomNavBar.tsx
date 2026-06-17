import { Home, Plus, Settings } from "lucide-react";

interface Props {
  currentView: "home" | "settings";
  onHome: () => void;
  onAdd: () => void;
  onSettings: () => void;
}

export default function BottomNavBar({ currentView, onHome, onAdd, onSettings }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-accent-grayLight/50 sm:hidden">
      <div className="flex items-center justify-around py-2">
        <button
          onClick={onHome}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
            currentView === "home"
              ? "text-accent-orange"
              : "text-accent-inkMute hover:text-accent-orange"
          }`}
        >
          <Home size={22} strokeWidth={currentView === "home" ? 2.5 : 2} />
          <span className="text-[10px] font-medium">首页</span>
        </button>
        
        <button
          onClick={onAdd}
          className="relative flex items-center justify-center w-14 h-14 -mt-6 bg-accent-orange rounded-full shadow-lg shadow-accent-orange/30 hover:shadow-xl hover:shadow-accent-orange/40 transition-all duration-200 active:scale-95"
        >
          <Plus size={28} className="text-white" strokeWidth={2.5} />
        </button>
        
        <button
          onClick={onSettings}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
            currentView === "settings"
              ? "text-accent-orange"
              : "text-accent-inkMute hover:text-accent-orange"
          }`}
        >
          <Settings size={22} strokeWidth={currentView === "settings" ? 2.5 : 2} />
          <span className="text-[10px] font-medium">设置</span>
        </button>
      </div>
    </nav>
  );
}