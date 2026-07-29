"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// `endpoint` is globally unique per browser/device subscription (see the
// PushSubscription model comment), so upserting on it is what makes this
// idempotent — re-subscribing the same device (e.g. after the browser
// silently rotated the subscription) just updates the keys in place
// instead of creating a duplicate row.
export async function subscribeToPush(subscription: PushSubscriptionInput) {
  const user = await requireUser();

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      userId: user.id,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    create: {
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

// Scoped to the caller's own userId (not a bare delete-by-endpoint) so
// someone can't unsubscribe a different user's device just by knowing or
// guessing their endpoint string — same reasoning as every other
// caller-scoped mutation in this app.
export async function unsubscribeFromPush(endpoint: string) {
  const user = await requireUser();
  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: user.id },
  });
}
