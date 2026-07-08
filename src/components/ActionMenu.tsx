"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export type ActionMenuItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  // External link item (e.g. "導航" opening Google Maps) instead of a
  // click handler — renders an <a> so it behaves like a normal link
  // (open-in-new-tab, middle-click, etc.) rather than a JS-only action.
  href?: string;
  external?: boolean;
  variant?: "default" | "danger";
};

// Shared "more actions" dropdown — extracted from DayTimeline.tsx's
// per-item menu (outside-click + Escape to close), so any card that needs
// a secondary-actions menu doesn't reimplement that wiring.
export default function ActionMenu({
  items,
  label = "更多操作",
}: {
  items: ActionMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-h-11 min-w-11 items-center justify-center text-ink-500 hover:text-brand-600"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-line bg-surface py-1 text-sm shadow-lg"
        >
          {items.map(({ key, label: itemLabel, icon: Icon, onClick, href, external, variant }) => {
            const itemClassName = `flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-paper-alt ${
              variant === "danger" ? "text-red-600 hover:bg-red-50" : "text-ink-700"
            }`;
            if (href) {
              return (
                <a
                  key={key}
                  href={href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  onClick={() => setOpen(false)}
                  className={itemClassName}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {itemLabel}
                </a>
              );
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onClick?.();
                }}
                className={itemClassName}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {itemLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
