import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { Check, X, AlertCircle, Info } from "lucide-react";

export interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  add: (toast: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let addToastCallback: ((toast: Omit<Toast, "id">) => void) | null = null;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => {
    setToasts([]);
  }, []);

  useEffect(() => {
    addToastCallback = add;
    return () => {
      addToastCallback = null;
    };
  }, [add]);

  return (
    <ToastContext.Provider value={{ toasts, add, remove, clear }}>
      {children}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const showToast = (type: Toast["type"], message: string, duration?: number) => {
  if (addToastCallback) {
    addToastCallback({ type, message, duration });
  }
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
    const timers = toasts.map((toast) => {
      return setTimeout(() => {
        remove(toast.id);
      }, toast.duration || 3000);
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
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