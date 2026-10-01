import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  // Ignored since the 2026-10-01 restyle (headers are text-only); kept so
  // existing callers still compile.
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${className ?? ""}`}>
      {/* No leading icon since the 2026-10-01 restyle — `icon` is still
          accepted (unused) so existing callers don't need touching. */}
      <h2 className="text-lg font-bold text-ink-900 sm:text-xl">{title}</h2>
      {action}
    </div>
  );
}
