import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type AppButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type AppButtonSize = "sm" | "md";

const VARIANT_CLASSES: Record<AppButtonVariant, string> = {
  primary: "bg-brand-800 text-white hover:bg-brand-700",
  secondary: "border border-slate-200 bg-white text-ink-700 hover:bg-slate-50",
  ghost: "text-brand-600 hover:bg-brand-50",
  danger: "text-red-600 hover:bg-red-50",
};

const SIZE_CLASSES: Record<AppButtonSize, string> = {
  sm: "gap-1 px-3 py-1.5 text-xs",
  md: "gap-1.5 px-4 py-2 text-sm",
};

export type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  isLoading?: boolean;
  icon?: ReactNode;
};

// Shared button primitive — see 功能擴充建議.txt's design-system request.
// Covers the four cases actually used across the app (primary CTA, neutral
// secondary action, inline ghost/link-style action, destructive action)
// instead of every page hand-rolling its own button className.
const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(function AppButton(
  { variant = "primary", size = "md", isLoading, icon, children, className, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl font-medium whitespace-nowrap transition disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className ?? ""}`}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export default AppButton;
