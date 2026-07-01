"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "trip-planner-install-hint-dismissed";

export default function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !("MSStream" in window);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";

    // One-time environment check on mount (iOS + not-installed + not
    // dismissed) — not a value that changes and needs a live subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(isIOS && !isStandalone && !dismissed);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md p-3">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
        <p className="flex-1 text-slate-700">
          點下方分享鍵 <Share className="inline h-4 w-4 align-text-bottom" />{" "}
          →「加入主畫面」，把行程規劃加到手機桌面
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="關閉"
          className="shrink-0 p-1 text-slate-400 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
