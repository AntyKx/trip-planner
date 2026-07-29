import webpush, { WebPushError } from "web-push";
import { prisma } from "./prisma";

// Only actually sends when all three VAPID env vars are set — lets local
// dev / preview environments without them configured skip silently instead
// of crashing every cron invocation. Set once at module load, not inside
// sendPushToUser, since setVapidDetails throwing on missing keys would
// otherwise happen on every call.
const vapidReady =
  !!process.env.VAPID_SUBJECT &&
  !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  !!process.env.VAPID_PRIVATE_KEY;

if (vapidReady) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export type PushPayload = {
  title: string;
  body: string;
  // Opened (or focused, if already open) when the notification is tapped —
  // see push-sw.js's notificationclick handler. Defaults to "/" there if
  // omitted.
  url?: string;
  // Lets a later push replace an earlier still-unread one instead of
  // stacking (e.g. re-sending a corrected weather warning) — the Notifications
  // API dedupes by tag automatically.
  tag?: string;
};

// Sends to every device the user has subscribed from. A dead subscription
// (user revoked permission, uninstalled, or the push service otherwise
// discarded it) is pruned on a 404/410 response instead of left to fail the
// same way every future send — anything else is logged and left alone
// (could be transient).
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!vapidReady) {
    console.error("sendPushToUser called without VAPID env vars configured");
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {
            // Already gone (e.g. the user unsubscribed in the same window
            // this send was in flight) — nothing left to clean up.
          });
        } else {
          console.error(`sendPushToUser: send failed for subscription ${sub.id}:`, err);
        }
      }
    })
  );
}
