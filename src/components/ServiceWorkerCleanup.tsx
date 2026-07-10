"use client";

import { useEffect } from "react";

// Retires the offline-fallback service worker (previously public/sw.js,
// now removed) — intercepting every single page navigation to support the
// rare "phone was offline the whole time" case turned out to cost more
// than it was worth: no navigation preload meant every page load paid a
// worker-wake-up tax, and caching a dynamic, per-user, per-role page's HTML
// meant any brief network hiccup could fall back to a stale snapshot
// (wrong edit permissions, stale data) instead of erroring loudly. Anyone
// who already has the old service worker registered needs this active
// unregister — deleting the file server-side does nothing for a browser
// that already installed it.
export default function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }, []);

  return null;
}
