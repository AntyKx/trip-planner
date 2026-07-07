import type { HTMLAttributes } from "react";

export type AppCardSize = "md" | "lg";

const SIZE_CLASSES: Record<AppCardSize, string> = {
  md: "rounded-card",
  lg: "rounded-card-lg",
};

export type AppCardProps = HTMLAttributes<HTMLDivElement> & {
  size?: AppCardSize;
};

// Shared card shell — soft shadow + consistent radius (18px regular /
// 24px large, per the design-system spec) instead of every page picking
// its own rounded-xl/shadow-sm combination.
export default function AppCard({ size = "md", className, children, ...props }: AppCardProps) {
  return (
    <div
      className={`border border-slate-200 bg-white shadow-soft ${SIZE_CLASSES[size]} ${className ?? ""}`}
      {...props}
    >
      {children}
    </div>
  );
}
