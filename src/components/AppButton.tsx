import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type AppButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerFilled";
export type AppButtonSize = "sm" | "md";

// danger is the ghost-style destructive action (safe to show inline,
// e.g. next to other actions); dangerFilled is reserved for the actual
// confirm step of a destructive flow (a confirm dialog's real "delete"
// button), so a destructive action never looks equally loud everywhere
// it appears.
const VARIANT_CLASSES: Record<AppButtonVariant, string> = {
  primary: "bg-brand-800 text-white hover:bg-brand-700",
  secondary: "border border-line bg-surface text-ink-700 hover:bg-paper-alt",
  ghost: "text-brand-600 hover:bg-brand-50",
  danger: "text-danger-600 hover:bg-danger-50",
  dangerFilled: "bg-danger-600 text-white hover:bg-danger-700",
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

// Exported so a real <Link> (navigation, not an action) can look exactly
// like an AppButton without actually being a <button> — e.g. the "新增
// 旅程" CTA on Home needs real navigation semantics (prefetch, ctrl-click
// to open in a new tab), which a <button onClick={...}> can't offer.
export function appButtonClassName(
  variant: AppButtonVariant = "primary",
  size: AppButtonSize = "md",
  className?: string
): string {
  return `inline-flex shrink-0 items-center justify-center rounded-xl font-medium whitespace-nowrap transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className ?? ""}`;
}

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
      className={appButtonClassName(variant, size, className)}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export default AppButton;
