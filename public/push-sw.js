// Push-only service worker — deliberately does NOT touch `fetch` (no
// caching, no offline fallback). The previous service worker (public/sw.js,
// removed 2026-07-10) intercepted every navigation to support offline
// viewing, and that caused real problems: no navigation preload meant every
// page load paid a worker-wake-up tax, and caching a dynamic per-user page's
// HTML meant a brief network hiccup could serve a stale snapshot (wrong
// edit permissions, stale data) instead of erroring loudly. This worker's
// only job is receiving push events and handling notification clicks, so
// none of that risk applies here.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const { title, body, url, tag } = payload;
  if (!title) return;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag,
      data: { url: url || "/" },
    })
  );
});

// Clicking the notification focuses an already-open tab on that URL if one
// exists, otherwise opens a new one — avoids piling up duplicate tabs for
// someone who already has the app open when a push arrives. Matches on
// pathname + query (not just pathname) — the checklist reminder's URL is
// "/trips/{id}?mode=checklist", and comparing pathname alone would treat an
// already-open "/trips/{id}" tab (no query) as "already there" and just
// focus it without ever navigating to the checklist mode. Same pathname,
// different query navigates the existing tab instead of opening a
// duplicate one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  const target = new URL(targetUrl, self.location.origin);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          const clientUrl = new URL(client.url);
          if (clientUrl.pathname !== target.pathname || !("focus" in client)) continue;

          if (clientUrl.search !== target.search && "navigate" in client) {
            await client.navigate(target.href);
          }
          return client.focus();
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
