import { useEffect, useState } from "react";
import { Check, X, AlertCircle, Info } from "lucide-react";

export interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  add: (toast: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const toastStore: ToastStore = {
  toasts: [],
  add(toast) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    toastStore.toasts = [...toastStore.toasts, { ...toast, id }];
  },
  remove(id) {
    toastStore.toasts = toastStore.toasts.filter((t) => t.id !== id);
  },
  clear() {
    toastStore.toasts = [];
  },
};

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const update = () => setToasts([...toastStore.toasts]);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return {
    toasts,
    add: toastStore.add,
    remove: toastStore.remove,
    clear: toastStore.clear,
  };
};

export const showToast = (type: Toast["type"], message: string, duration?: number) => {
  toastStore.add({ type, message, duration });
};

const icons = {
  success: Check,
  error: X,
  info: Info,
  warning: AlertCircle,
};

const styles: Record<Toast["type"], string> = {
  success: "bg-accent-mint text-white",
  error: "bg-accent-red text-white",
  info: "bg-accent-blue text-white",
  warning: "bg-accent-orange text-white",
};

export default function ToastContainer() {
  const { toasts, remove } = useToast();

  useEffect(() => {
    toasts.forEach((toast) => {
      const timer = setTimeout(
        () => remove(toast.id),
        toast.duration || 3000
      );
      return () => clearTimeout(timer);
    });
  }, [toasts, remove]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 flex flex-col items-end">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-card ${styles[toast.type]} animate-floatUp max-w-sm`}
          >
            <Icon size={18} strokeWidth={2.5} />
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => remove(toast.id)}
              className="ml-2 opacity-80 hover:opacity-100 transition"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
