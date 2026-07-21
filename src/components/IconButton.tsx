import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type IconButtonVariant = "ghost" | "secondary" | "danger";

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost: "text-ink-500 hover:bg-paper-alt hover:text-ink-700",
  secondary: "border border-line bg-surface text-ink-700 hover:bg-paper-alt",
  danger: "text-danger-600 hover:bg-danger-50",
};

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: IconButtonVariant;
  icon: ReactNode;
  // Required, not optional — an icon-only control with no accessible
  // name is invisible to screen readers, and every existing icon-only
  // button in this app already sets one by hand (see e.g. the favorite
  // heart button in ExploreClient).
  "aria-label": string;
};

// Icon-only control at the same minimum touch target (44x44) as every
// other interactive element in this app (see globals.css's touch-action
// comment) — a dedicated component instead of every icon button
// hand-rolling its own min-h-11 min-w-11 flex centering.
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = "ghost", icon, className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 ${VARIANT_CLASSES[variant]} ${className ?? ""}`}
      {...props}
    >
      {icon}
    </button>
  );
});

export default IconButton;
