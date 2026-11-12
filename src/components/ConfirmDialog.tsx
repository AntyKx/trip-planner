"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import ModalOverlay, { type ModalOverlayHandle } from "./ModalOverlay";
import { appButtonClassName } from "./AppButton";

// In-app replacement for window.confirm(). The native dialog renders as a
// grey system sheet on iOS that looks nothing like the rest of the app, so
// every destructive/confirm step goes through this instead:
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "刪除行程？", message: "…", danger: true }))) return;
//
// Built on ModalOverlay so it gets the same bottom-sheet-on-mobile /
// centered-on-desktop shape, Escape/backdrop-to-cancel and exit animation
// as every other modal.

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red confirm button — for deletes and anything that can't be undone.
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void; key: number };

export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const keyRef = useRef(0);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending((prev) => {
        // A second confirm while one is open cancels the first rather than
        // leaving its promise hanging forever.
        prev?.resolve(false);
        return { ...options, resolve, key: keyRef.current++ };
      });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmSheet
          key={pending.key}
          pending={pending}
          onDone={(ok) => {
            pending.resolve(ok);
            setPending(null);
          }}
        />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmSheet({
  pending,
  onDone,
}: {
  pending: Pending;
  onDone: (ok: boolean) => void;
}) {
  const overlayRef = useRef<ModalOverlayHandle>(null);
  // Backdrop click / Escape / 取消 all leave this false; only the confirm
  // button flips it before the (animated) close finishes.
  const resultRef = useRef(false);
  const titleId = `confirm-title-${pending.key}`;

  function close(ok: boolean) {
    resultRef.current = ok;
    overlayRef.current?.requestClose();
  }

  return (
    <ModalOverlay
      ref={overlayRef}
      titleId={titleId}
      onClose={() => onDone(resultRef.current)}
      panelClassName="w-full max-w-sm p-5"
    >
      <h2 id={titleId} className="text-base font-bold text-ink-900">
        {pending.title}
      </h2>
      {pending.message && (
        <div className="mt-2 text-sm leading-relaxed text-ink-700">{pending.message}</div>
      )}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => close(false)}
          className={appButtonClassName("secondary", "md", "flex-1")}
        >
          {pending.cancelLabel ?? "取消"}
        </button>
        <button
          type="button"
          onClick={() => close(true)}
          className={appButtonClassName(pending.danger ? "dangerFilled" : "primary", "md", "flex-1")}
        >
          {pending.confirmLabel ?? "確定"}
        </button>
      </div>
    </ModalOverlay>
  );
}
