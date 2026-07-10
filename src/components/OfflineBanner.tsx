"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// Global offline indicator. The service worker (public/sw.js) lets a cold
// reopen while offline still show the last-cached page, but that content is
// read-only in spirit — edits (server actions) will fail with no network,
// so this banner makes that explicit instead of letting a save button just
// silently do nothing.
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator === "undefined" ? false : !navigator.onLine
  );

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
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
