import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
}: {
  // Optional now that every call site has a matching illustration (see
  // EmptyStateIllustrations.tsx) — kept so a future empty state without one
  // yet can still fall back to a plain icon instead of being blocked on
  // drawing a new SVG first.
  icon?: LucideIcon;
  illustration?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-card-lg border border-dashed border-brand-200 bg-surface px-6 py-16 text-center ${className ?? ""}`}
    >
      {illustration ?? (Icon && <Icon className="h-10 w-10 text-brand-300" />)}
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description && <p className="text-xs text-ink-500">{description}</p>}
      {action}
    </div>
  );
}
