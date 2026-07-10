"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

const CHECK_TIMEOUT_MS = 5000;

// Global offline indicator. The service worker (public/sw.js) lets a cold
// reopen while offline still show the last-cached page, but that content is
// read-only in spirit — edits (server actions) will fail with no network,
// so this banner makes that explicit instead of letting a save button just
// silently do nothing.
//
// Deliberately does NOT trust navigator.onLine / the online-offline events
// on their own — on Windows in particular, that flag reflects whatever the
// OS reports for *any* network adapter (VPN, Hyper-V/WSL virtual adapters,
// etc.) and can read "offline" while a perfectly working Wi-Fi connection
// is up, showing this banner when the user very much has internet. Those
// events are only used as a hint to re-check; the actual state comes from
// a real request to the server (same /api/version endpoint UpdateChecker
// already polls).
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkReachability() {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
        const res = await fetch("/api/version", {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!cancelled) setIsOffline(!res.ok);
      } catch {
        if (!cancelled) setIsOffline(true);
      }
    }

    checkReachability();
    window.addEventListener("offline", checkReachability);
    window.addEventListener("online", checkReachability);
    document.addEventListener("visibilitychange", checkReachability);

    return () => {
      cancelled = true;
      window.removeEventListener("offline", checkReachability);
      window.removeEventListener("online", checkReachability);
      document.removeEventListener("visibilitychange", checkReachability);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-[9999] flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-sm text-white shadow-md">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>離線模式 · 顯示上次連線時的內容，編輯功能暫不可用</span>
    </div>
  );
}
