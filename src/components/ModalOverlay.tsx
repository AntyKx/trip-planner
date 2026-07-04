"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Shared overlay for all bottom-sheet/dialog style modals: locks background
// scroll, closes on Escape, and moves focus into the panel so keyboard/screen
// reader users aren't stranded behind the backdrop.
export default function ModalOverlay({
  onClose,
  titleId,
  panelClassName,
  children,
}: {
  onClose: () => void;
  titleId: string;
  panelClassName: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`rounded-t-2xl bg-white outline-none sm:rounded-2xl ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
