"use client";

import { useEffect } from "react";

// Retires the old offline-fallback service worker (previously public/sw.js,
// removed 2026-07-10) — intercepting every single page navigation to
// support the rare "phone was offline the whole time" case turned out to
// cost more than it was worth: no navigation preload meant every page load
// paid a worker-wake-up tax, and caching a dynamic, per-user, per-role
// page's HTML meant any brief network hiccup could fall back to a stale
// snapshot (wrong edit permissions, stale data) instead of erroring loudly.
// Anyone who already has that old service worker registered needs this
// active unregister — deleting the file server-side does nothing for a
// browser that already installed it.
//
// Scoped to skip /push-sw.js (added 2026-07-29) — that one's an
// intentional, currently-registered worker (push notifications only, no
// fetch handler, none of the risk above applies), so this can't be a blind
// "unregister everything" anymore or it would fight PushNotificationToggle
// every time this component re-runs on navigation.
export default function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        // A brand-new push-sw.js registration is `installing`/`waiting`
        // before it's `active` — checking only `.active` treated it as "not
        // push-sw.js" (empty scriptURL) during that window and unregistered
        // it out from under PushNotificationToggle, which registers on the
        // same page load. Check all three states a worker can be in.
        const scriptUrl =
          registration.active?.scriptURL ??
          registration.waiting?.scriptURL ??
          registration.installing?.scriptURL ??
          "";
        if (!scriptUrl.endsWith("/push-sw.js")) {
          registration.unregister();
        }
      });
    });
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }, []);

  return null;
}
