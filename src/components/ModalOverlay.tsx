"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// 280ms — matches the speed the user picked when reviewing a live demo of
// this animation (see empty-state-and-modal-motion-review artifact,
// 2026-07-13). Mobile slides up from the bottom (matching the bottom-sheet
// shape below), desktop fades + scales from 96% (matching the centered
// dialog shape) — see the sm: overrides on the panel classes.
const CLOSE_DURATION_MS = 280;

// Every modal built on this component renders its own close ("X") button
// inside `children`, not inside ModalOverlay itself — but that button still
// needs to go through the same animated-close path as the backdrop click
// and Escape key, or it would cut straight to an instant unmount instead of
// playing the exit transition. This context is how a close button nested
// anywhere in `children` reaches the same requestClose() this file uses
// internally, without every modal having to re-implement the close-then-
// wait-then-unmount timing itself.
const ModalCloseContext = createContext<() => void>(() => {});

export function useRequestModalClose() {
  return useContext(ModalCloseContext);
}

// Must be its own component (not just a plain <button onClick={...}> built
// inline by the modal that renders <ModalOverlay>) — useContext only sees a
// provider that's an ANCESTOR of the calling component in the render tree.
// The modal component (e.g. EditItemModal) is the parent of ModalOverlay,
// not a descendant of the context it provides internally, so calling the
// hook there would just get the no-op default. A separate component placed
// inside `children` only actually runs once React renders that position —
// by then it's beneath ModalOverlay's own provider, so the context read
// resolves correctly.
export function ModalCloseButton({
  className = "flex min-h-11 min-w-11 shrink-0 items-center justify-center text-ink-400 hover:text-ink-700",
}: {
  className?: string;
}) {
  const requestClose = useRequestModalClose();
  return (
    <button
      type="button"
      onClick={requestClose}
      aria-label="關閉"
      className={className}
    >
      <X className="h-5 w-5" />
    </button>
  );
}

export type ModalOverlayHandle = { requestClose: () => void };

// For the handful of modals (EditItemModal, JournalEditModal) that close
// themselves programmatically after a successful save rather than only via
// the close button/backdrop/Escape — a ref (unlike context) works from an
// ancestor, so this is how those call sites reach the same animated close
// instead of calling their own `onClose` prop directly and skipping the
// exit transition.
const ModalOverlay = forwardRef<
  ModalOverlayHandle,
  {
    onClose: () => void;
    titleId: string;
    panelClassName: string;
    children: ReactNode;
  }
>(function ModalOverlay({ onClose, titleId, panelClassName, children }, ref) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Starts closed and flips to true on the next frame after mount, so the
  // very first render paints the "closed" position/opacity for the
  // transition to actually animate from — mounting already-`visible` would
  // have nothing to transition away from.
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Double rAF: a single frame isn't reliably enough for some browsers
    // (notably Safari) to have actually painted the "closed" starting state
    // before flipping to "open" — without the second frame the transition
    // sometimes just snaps straight to the end state instead of animating.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function requestClose() {
    if (closeTimerRef.current) return; // already closing
    setVisible(false);
    closeTimerRef.current = setTimeout(onClose, CLOSE_DURATION_MS);
  }

  useImperativeHandle(ref, () => ({ requestClose }));

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        requestClose();
        return;
      }
      // Focus trap: Tab cycles within the dialog instead of escaping into
      // the (visually hidden but still tabbable) page behind it.
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const inside = panelRef.current.contains(active);
        if (
          e.shiftKey &&
          (!inside || active === first || active === panelRef.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (!inside || active === last)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag-to-close, mobile bottom-sheet style — listeners live on the grab
  // handle only (not the whole panel) so they can never fight the panel's
  // own scrolling content. Direct style writes (not state) so the panel
  // follows the finger without re-rendering every move.
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);

  function handleDragStart(e: React.TouchEvent) {
    dragStartYRef.current = e.touches[0].clientY;
    dragOffsetRef.current = 0;
    if (panelRef.current) panelRef.current.style.transitionDuration = "0ms";
  }

  function handleDragMove(e: React.TouchEvent) {
    if (dragStartYRef.current == null || !panelRef.current) return;
    const dy = Math.max(0, e.touches[0].clientY - dragStartYRef.current);
    dragOffsetRef.current = dy;
    panelRef.current.style.transform = `translateY(${dy}px)`;
  }

  function handleDragEnd() {
    if (dragStartYRef.current == null || !panelRef.current) return;
    const dy = dragOffsetRef.current;
    dragStartYRef.current = null;
    panelRef.current.style.transitionDuration = "";
    panelRef.current.style.transform = "";
    if (dy > 80) requestClose();
  }

  // Portal straight to <body> — this backdrop is `position: fixed; inset:
  // 0`, which is only actually viewport-sized as long as NO ancestor
  // establishes a containing block for it. Any ancestor with a transform,
  // filter, or (as of the individual transform properties in CSS
  // Transforms Level 2) a non-none translate/scale/rotate does that —
  // including a plain `hover:-translate-y-0.5` card-lift effect several
  // levels up. Rendered in place (no portal), opening this modal while
  // hovering such a card silently shrank the backdrop down to that card's
  // own box instead of the full screen, and — because browsers don't
  // always re-release that containing-block relationship the instant the
  // hover ends — the backdrop would suddenly snap back to full-screen
  // moments after the mouse moved away, reading as the whole dialog
  // flickering shut and reopening. A portal makes this modal's fixed
  // positioning immune to every such ancestor, present or future, instead
  // of chasing down each individual transform/translate offender.
  return createPortal(
    <div
      className={`fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-black/50 transition-opacity motion-reduce:transition-none sm:items-center sm:p-4 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ transitionDuration: `${CLOSE_DURATION_MS}ms` }}
      onClick={requestClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-t-2xl bg-surface outline-none transition-[opacity,transform] motion-reduce:transition-none sm:max-h-[85vh] sm:rounded-2xl ${
          visible
            ? "translate-y-0 opacity-100 sm:scale-100"
            : "translate-y-8 opacity-0 sm:translate-y-0 sm:scale-95"
        } ${panelClassName}`}
        style={{ transitionDuration: `${CLOSE_DURATION_MS}ms` }}
      >
        {/* Mobile-only grab handle: visual bottom-sheet affordance + the
            drag-to-close touch target. Generous hit area (py) around the
            thin bar; desktop hides it entirely (centered dialogs don't
            drag). */}
        <div
          className="-mt-2 flex justify-center pb-1 pt-2 sm:hidden"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div
            className="h-1 w-9 rounded-full bg-line-strong"
            aria-hidden="true"
          />
        </div>
        <ModalCloseContext.Provider value={requestClose}>
          {children}
        </ModalCloseContext.Provider>
        {/* Bottom sheets sit flush with the screen edge on mobile — keep
            content clear of the iPhone home indicator. */}
        <div
          className="h-[env(safe-area-inset-bottom)] sm:hidden"
          aria-hidden="true"
        />
      </div>
    </div>,
    document.body,
  );
});

export default ModalOverlay;
