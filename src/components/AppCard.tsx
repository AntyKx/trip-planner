import type { HTMLAttributes } from "react";

export type AppCardSize = "md" | "lg";
export type AppCardVariant = "flat" | "raised" | "interactive";
export type AppCardPadding = "none" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AppCardSize, string> = {
  md: "rounded-card",
  lg: "rounded-card-lg",
};

// "none" is the default on purpose — every existing caller already
// supplies its own padding via className (e.g. `p-4`), so defaulting to
// a no-op here means adding this prop doesn't double up spacing on any
// of them. New call sites can opt into a preset instead of hand-rolling
// their own p-* value.
const PADDING_CLASSES: Record<AppCardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

// flat has no shadow at all — the design-system pass this came from
// flagged "every block turned into a shadowed card" as visual noise, so
// flat (not raised) is the default for ordinary list/content cards.
// raised is reserved for a few deliberately-emphasized surfaces (hero,
// the homepage's next-trip card). interactive stays flat at rest and
// only produces a shadow + lift on hover, for cards that are themselves
// a click target (e.g. explore search results).
const VARIANT_CLASSES: Record<AppCardVariant, string> = {
  flat: "",
  raised: "shadow-raised",
  interactive: "transition hover:shadow-raised hover:-translate-y-0.5",
};

export type AppCardProps = HTMLAttributes<HTMLDivElement> & {
  size?: AppCardSize;
  variant?: AppCardVariant;
  padding?: AppCardPadding;
};

// Shared card shell — consistent border/radius, with shadow and padding
// as explicit opt-in choices instead of every card defaulting to the
// same heavy shadow regardless of context.
export default function AppCard({
  size = "md",
  variant = "flat",
  padding = "none",
  className,
  children,
  ...props
}: AppCardProps) {
  return (
    <div
      className={`border border-line bg-surface ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${PADDING_CLASSES[padding]} ${className ?? ""}`}
      {...props}
    >
      {children}
    </div>
  );
}
