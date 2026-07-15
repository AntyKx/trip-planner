"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Info, TriangleAlert, CheckCircle2, Sparkles, X, type LucideIcon } from "lucide-react";

export type SmartBannerVariant = "info" | "warning" | "success" | "ai";

const VARIANT_STYLE: Record<
  SmartBannerVariant,
  { icon: LucideIcon; className: string }
> = {
  info: { icon: Info, className: "border-brand-100 bg-brand-50 text-brand-700" },
  warning: { icon: TriangleAlert, className: "border-amber-100 bg-amber-50 text-amber-700" },
  success: { icon: CheckCircle2, className: "border-emerald-100 bg-emerald-50 text-emerald-700" },
  ai: { icon: Sparkles, className: "border-accent-100 bg-accent-50 text-accent-700" },
};

// Reusable proactive-reminder banner (UI v3 §六). The caller renders at
// most ONE of these at a time and only with real data behind it — never a
// fabricated percentage or made-up weather. Dismissal persists for the
// session via sessionStorage, keyed by `dismissKey`: include the salient
// state in the key (e.g. the issue count) so a materially-changed reminder
// resurfaces even after an earlier version was dismissed.
export default function SmartBanner({
  dismissKey,
  variant,
  title,
  description,
  action,
}: {
  dismissKey: string;
  variant: SmartBannerVariant;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const storageKey = `trip-planner:banner-dismissed:${dismissKey}`;
  // Starts hidden and reveals post-mount — sessionStorage doesn't exist
  // during SSR, and rendering first then hiding would flash.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(sessionStorage.getItem(storageKey) == null);
    } catch {
      setVisible(true);
    }
  }, [storageKey]);

  if (!visible) return null;

  const { icon: Icon, className } = VARIANT_STYLE[variant];

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // Storage unavailable — banner just reappears next page load.
    }
  }

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 rounded-card-lg border p-3.5 text-sm animate-fade-in ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-0.5 text-xs opacity-80">{description}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="關閉提醒"
        className="shrink-0 rounded-md p-1 opacity-60 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
