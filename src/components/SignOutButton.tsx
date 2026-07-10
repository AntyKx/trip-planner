"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/login/actions";

// Clears the offline page cache (public/sw.js) on sign-out. Cache Storage is
// origin-scoped, not session-scoped, so without this a shared/borrowed
// device would keep serving the previous account's cached trip pages to
// whoever opens the app offline next.
function clearOfflineCache() {
  if (typeof caches === "undefined") return;
  caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
}

export default function SignOutButton() {
  return (
    <form action={signOutAction} onSubmit={clearOfflineCache}>
      <button
        type="submit"
        className="flex items-center gap-1 text-xs text-ink-500 hover:text-brand-600"
      >
        <LogOut className="h-3.5 w-3.5" />
        登出
      </button>
    </form>
  );
}
