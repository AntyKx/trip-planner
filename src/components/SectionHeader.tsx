import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  icon: Icon,
  action,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${className ?? ""}`}>
      <h2 className="flex items-center gap-1.5 text-lg font-semibold text-ink-900 sm:text-xl">
        {Icon && <Icon className="h-4 w-4 text-brand-600" />}
        {title}
      </h2>
      {action}
    </div>
  );
}
