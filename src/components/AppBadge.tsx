import type { HTMLAttributes } from "react";

export type AppBadgeVariant = "neutral" | "brand" | "success" | "warning" | "danger" | "ai";

const VARIANT_CLASSES: Record<AppBadgeVariant, string> = {
  neutral: "bg-paper-alt text-ink-700",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-600",
  // AI/highlight accent — reuses the existing warm-yellow accent tokens
  // rather than introducing a new hue just for AI features.
  ai: "bg-accent-50 text-accent-700",
};

export type AppBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: AppBadgeVariant;
};

export default function AppBadge({ variant = "neutral", className, children, ...props }: AppBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]} ${className ?? ""}`}
      {...props}
    >
      {children}
    </span>
  );
}
