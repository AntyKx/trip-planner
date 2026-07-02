"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const CURRENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export default function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkVersion() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data: { buildId?: string } = await res.json();
        if (!cancelled && data.buildId && data.buildId !== CURRENT_BUILD_ID) {
          setUpdateAvailable(true);
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
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-teal-600 px-4 py-2 text-sm text-white">
      <span>有新版本可以更新</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-1 rounded-md bg-white/20 px-3 py-1 font-medium hover:bg-white/30"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        重新整理
      </button>
    </div>
  );
}
