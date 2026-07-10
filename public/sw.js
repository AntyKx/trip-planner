// Minimal offline-fallback service worker. Not a performance cache — every
// GET when online still hits the network first, so a fresh deploy is never
// masked by a stale cached page (see UpdateChecker's /api/version polling,
// which keeps working normally since this SW never intercepts that route).
// The cache only exists as a "last known good" snapshot to serve when the
// device has genuinely no connection (e.g. reopening the installed PWA in
// airplane mode) — that's a case a plain IndexedDB snapshot can't cover,
// since the browser can't even repaint the page shell without a cached
// response to fall back to.
const CACHE_NAME = "trip-planner-offline-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable; POSTs (server actions, uploads) must always hit
  // the network so we don't accidentally serve a stale response for one or
  // silently "succeed" an action that never reached the server.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Next.js build assets are content-hashed and immutable — a stale cache
  // entry can only ever be for a chunk that still matches the current HTML,
  // so cache-first here is safe and doesn't need the BUILD_ID coordination
  // that caching whole pages would.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // Full page navigations (cold load / reopen the installed app): network
  // first so online users always get the current deploy, falling back to
  // whatever was last successfully cached only when the fetch itself fails.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
  }
});
