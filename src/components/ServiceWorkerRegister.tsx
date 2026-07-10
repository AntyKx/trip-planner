"use client";

import { useEffect } from "react";

// Registers the offline-fallback service worker (see public/sw.js). Silent
// no-op in browsers without support (e.g. some in-app webviews) — this is a
// progressive enhancement, not something the rest of the app depends on.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
