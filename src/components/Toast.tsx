"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, Info, X, type LucideIcon } from "lucide-react";

type ToastVariant = "success" | "error" | "info";
type ToastItem = { id: number; message: string; variant: ToastVariant; leaving: boolean };

export type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const VARIANT_STYLE: Record<ToastVariant, { icon: LucideIcon; className: string }> = {
  success: { icon: CheckCircle2, className: "text-emerald-600" },
  error: { icon: XCircle, className: "text-red-600" },
  info: { icon: Info, className: "text-brand-600" },
};

const DISPLAY_MS = 3000;
const LEAVE_MS = 200;

// Deliberately no animation library — this only ever needs an enter
// keyframe (see animate-toast-in in globals.css) and a CSS transition on
// the way out (the `leaving` flag), neither of which needs
// AnimatePresence/layout tracking the way list delete/reorder does.
export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, LEAVE_MS);
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = idRef.current++;
      setToasts((prev) => [...prev, { id, message, variant, leaving: false }]);
      setTimeout(() => dismiss(id), DISPLAY_MS);
    },
    [dismiss]
  );

  const api: ToastApi = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
    info: (message) => push("info", message),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {toasts.map((t) => {
          const { icon: Icon, className } = VARIANT_STYLE[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 shadow-soft transition-all duration-200 ${
                t.leaving
                  ? "translate-y-2 opacity-0"
                  : "translate-y-0 opacity-100 animate-toast-in"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${className}`} />
              <span className="min-w-0 flex-1 truncate">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="關閉"
                className="shrink-0 text-ink-500 hover:text-ink-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
