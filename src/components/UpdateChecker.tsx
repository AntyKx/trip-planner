"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const CURRENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RELOAD_DELAY_MS = 2200;
// If the user is mid-edit (typing in a field / modal open), don't yank the
// page out from under them — recheck at this cadence until it's safe.
const SAFE_RECHECK_MS = 3000;

function isEditingSomething() {
  // Any open modal (place details, journal photo lightbox, edit dialogs,
  // …) counts as "busy" even though its focused element is a plain button
  // or link, not a form field — every modal in the app renders
  // role="dialog" (see ModalOverlay.tsx), so this one check covers all of
  // them without each caller needing to know about the update checker.
  if (document.querySelector('[role="dialog"]')) return true;

  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export default function UpdateChecker() {
  const [updating, setUpdating] = useState(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    function scheduleReloadWhenSafe() {
      if (reloadTimerRef.current) return;
      if (isEditingSomething()) {
        reloadTimerRef.current = setTimeout(() => {
          reloadTimerRef.current = null;
          scheduleReloadWhenSafe();
        }, SAFE_RECHECK_MS);
        return;
      }
      setUpdating(true);
      reloadTimerRef.current = setTimeout(() => {
        // Re-check right before actually reloading — a modal could have
        // opened during the visible countdown above, after the check that
        // got us here already passed.
        if (isEditingSomething()) {
          setUpdating(false);
          reloadTimerRef.current = null;
          scheduleReloadWhenSafe();
          return;
        }
        window.location.reload();
      }, RELOAD_DELAY_MS);
    }

    async function checkVersion() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data: { buildId?: string } = await res.json();
        if (!cancelled && data.buildId && data.buildId !== CURRENT_BUILD_ID) {
          scheduleReloadWhenSafe();
        }
      } catch {
        // Offline or request failed — ignore, just try again later.
      }
    }

    checkVersion();
    const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") checkVersion();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (!updating) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[var(--z-critical)] flex flex-col gap-1.5 bg-brand-600 px-4 py-2.5 text-white shadow-md">
      <div className="flex items-center gap-2 text-sm">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="font-medium">偵測到新版本，正在自動更新…</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/25">
        <div
          className="h-full rounded-full bg-white"
          style={{
            animation: `update-progress ${RELOAD_DELAY_MS}ms linear forwards`,
          }}
        />
      </div>
      <style>{`
        @keyframes update-progress {
          from { width: 0% }
          to { width: 100% }
        }
      `}</style>
    </div>
  );
}
