"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "trip-planner-install-hint-dismissed";

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const pathname = usePathname();
  // Trip detail pages have their own fixed bottom tab bar on mobile (see
  // TripDayBoard) — without this, the two would stack on top of each other
  // on iOS Safari before the app's ever been installed.
  const hasBottomTabBar = pathname?.startsWith("/trips/") && pathname !== "/trips/new";

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
    <div
      className={`fixed inset-x-0 z-40 mx-auto w-full max-w-md p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
        // Flat "4rem" alone underestimates on devices with a tall
        // safe-area-inset-bottom (e.g. ~34px Home Indicator) — the tab
        // bar's own height already includes that inset (see
        // TripDayBoard's bottom nav), so this has to add it again here
        // too, or the prompt still overlaps the bottom of the tab bar on
        // exactly the notched iPhones this prompt targets.
        hasBottomTabBar ? "bottom-[calc(4rem+env(safe-area-inset-bottom))]" : "bottom-0"
      }`}
    >
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-sm shadow-lg">
        <p className="flex-1 text-ink-700">
          點下方分享鍵 <Share className="inline h-4 w-4 align-text-bottom" />{" "}
          →「加入主畫面」，把行程規劃加到手機桌面
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="關閉"
          className="shrink-0 p-1 text-ink-400 hover:text-ink-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
