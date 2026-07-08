"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import ModalOverlay from "./ModalOverlay";

// Consistent modal chrome (title bar + close button + scrollable body +
// optional footer) built on top of ModalOverlay, which already handles the
// bottom-sheet-on-mobile / centered-on-desktop behavior, scroll lock, and
// Escape-to-close. Generalizes the header pattern TransitAlternativesModal/
// PlaceDetailsModal each hand-roll today.
export default function AppModal({
  titleId,
  title,
  onClose,
  footer,
  maxWidthClassName = "max-w-lg",
  children,
}: {
  titleId: string;
  title: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  maxWidthClassName?: string;
  children: ReactNode;
}) {
  return (
    <ModalOverlay
      onClose={onClose}
      titleId={titleId}
      panelClassName={`flex max-h-[85vh] w-full ${maxWidthClassName} flex-col overflow-hidden`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line p-4">
        <h2 id={titleId} className="min-w-0 truncate text-base font-bold text-ink-900">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-ink-400 hover:text-ink-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="overflow-y-auto p-4">{children}</div>
      {footer && <div className="border-t border-line p-4">{footer}</div>}
    </ModalOverlay>
  );
}
