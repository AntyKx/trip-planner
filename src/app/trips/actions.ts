"use server";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, requireTripEditor, requireTripOwner } from "@/lib/auth";
import { getDailyWeather, type DailyWeather } from "@/lib/weather";
import { isOwnBlobUrl, deleteBlobsQuietly } from "@/lib/blob";
import { MAX_PHOTOS_PER_ITEM, MAX_JOURNAL_TEXT_LENGTH } from "@/lib/limits";
import { generateChecklistForTrip } from "./[id]/checklistActions";

// requireTripEditor/requireTripOwner only check that the caller has a role
// on `tripId` — they say nothing about whether the `dayId`/`itemId` the
// caller also supplied actually belongs to that trip. Without this check,
// a user with edit access to *any* trip of their own (trivially true —
// everyone owns at least their own trips) could pass someone else's day/
// item id alongside their own tripId and mutate that other trip's data,
// having only ever seen those ids by viewing it (even as VIEWER). Every
// action below that takes both a tripId and a day/item id needs one of
// these, or the equivalent scoped updateMany/deleteMany `where`.
async function requireDayInTrip(tripId: string, dayId: string) {
  const day = await prisma.tripDay.findFirst({
    where: { id: dayId, tripId },
    select: { id: true },
  });
  if (!day) redirect("/");
}

// Weather is fetched from the client after the trip page has already
// rendered, not during SSR — open-meteo has no SLA, and blocking the whole
// page on N external calls (one per day) meant a single slow/unreachable
// call held up the entire page load. This is public, non-sensitive data,
// so no ownership check is needed beyond a normal signed-in user.
export async function fetchDayWeather(
  lat: number,
  lng: number,
  dateIso: string
): Promise<DailyWeather | null> {
  await requireUser();
  return getDailyWeather(lat, lng, new Date(dateIso));
}

// No revalidatePath here on purpose: item order isn't read by any other
// server-rendered piece of this page (map/budget both key routes and costs
// by item id, not array position), and the client already reflects the new
// order optimistically. Revalidating would force the whole trip page's
// query + weather fetches to re-run synchronously on every drag, which is
// the main thing that made drag-reordering feel slow.
export async function reorderItems(
  tripId: string,
  dayId: string,
  orderedItemIds: string[]
) {
  await requireTripEditor(tripId);
  await requireDayInTrip(tripId, dayId);
  await prisma.$transaction(
    orderedItemIds.map((id, index) =>
      // updateMany (not update) so this scopes to dayId too — an id that
      // isn't actually one of this day's items just updates zero rows
      // instead of silently reaching into another trip's data.
      prisma.item.updateMany({
        where: { id, dayId },
        data: { sortOrder: index + 1 },
      })
    )
  );
}

// Batch write for the auto-schedule feature (AutoScheduleModal) — one
// transaction for the whole day instead of N updateItem round trips. Same
// no-revalidatePath reasoning as reorderItems above: the client updates
// its items state optimistically after this resolves.
export async function updateItemTimes(
  tripId: string,
  dayId: string,
  updates: { itemId: string; startTime: string; endTime: string }[]
) {
  await requireTripEditor(tripId);
  await requireDayInTrip(tripId, dayId);

  // A day realistically holds a handful of items — anything bigger is not
  // a real client, so cap it rather than build an unbounded transaction.
  const bounded = updates.slice(0, 50).filter((u) => {
    const start = new Date(u.startTime);
    const end = new Date(u.endTime);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime());
  });

  await prisma.$transaction(
    bounded.map((u) =>
      // updateMany + dayId scope, same reasoning as reorderItems: an
      // itemId from another trip just updates zero rows.
      prisma.item.updateMany({
        where: { id: u.itemId, dayId },
        data: { startTime: new Date(u.startTime), endTime: new Date(u.endTime) },
      })
    )
  );
}

export type TravelModeValue = "WALK" | "TRANSIT" | "DRIVE" | "BIKE";

export type RouteInput = {
  fromItemId: string;
  toItemId: string;
  mode: TravelModeValue;
  durationMin: number;
  distanceKm: number;
};

// Replaces every Route for this day with a fresh set — called after
// optimize or after recomputing transit times for the current order,
// since the previous adjacency is no longer meaningful either way.
export async function saveRoutes(
  tripId: string,
  dayId: string,
  country: string,
  routes: RouteInput[]
) {
  await requireTripEditor(tripId);
  await requireDayInTrip(tripId, dayId);

  // Only keep legs whose endpoints are actually items on this day — a
  // fromItemId/toItemId pointing at another trip's item shouldn't be
  // storable just because dayId itself checked out.
  const dayItemIds = new Set(
    (await prisma.item.findMany({ where: { dayId }, select: { id: true } })).map(
      (i) => i.id
    )
  );
  const validRoutes = routes.filter(
    (r) => dayItemIds.has(r.fromItemId) && dayItemIds.has(r.toItemId)
  );

  await prisma.$transaction([
    prisma.route.deleteMany({ where: { dayId } }),
    ...validRoutes.map((r) =>
      prisma.route.create({
        data: {
          dayId,
          fromItemId: r.fromItemId,
          toItemId: r.toItemId,
          mode: r.mode,
          durationMin: Math.round(r.durationMin),
          distanceKm: Math.round(r.distanceKm * 10) / 10,
          country,
          provider: "google",
        },
      })
    ),
  ]);
  revalidatePath(`/trips/${tripId}`);
}

export type NewPlaceInput = {
  name: string;
  category: string;
  country: string;
  address?: string;
  lat: number;
  lng: number;
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
  provider: string;
  externalId: string;
  // Structured opening-hours JSON (see src/lib/businessHours.ts) — stored
  // once so later time-range checks (EditItemModal) don't need to hit
  // Google again. Only present when the caller already fetched it (e.g.
  // ExploreClient checking the day-of-week before adding).
  openHours?: string;
  // "PLACE" | "RESTAURANT" — persisted so re-adding from "我的收藏" keeps
  // the same classification search originally made.
  suggestedType?: string;
};

export async function addPlaceToDay(
  tripId: string,
  dayId: string,
  itemType: "PLACE" | "RESTAURANT" | "HOTEL" | "CUSTOM",
  place: NewPlaceInput
) {
  await requireTripEditor(tripId);
  await requireDayInTrip(tripId, dayId);
  const dbPlace = await prisma.place.upsert({
    where: {
      provider_externalId: {
        provider: place.provider,
        externalId: place.externalId,
      },
    },
    update: {
      photoUrl: place.photoUrl,
      ...(place.openHours ? { openHours: place.openHours } : {}),
      ...(place.suggestedType ? { suggestedType: place.suggestedType } : {}),
    },
    create: place,
  });

  const lastItem = await prisma.item.findFirst({
    where: { dayId },
    orderBy: { sortOrder: "desc" },
  });

  const item = await prisma.item.create({
    data: {
      dayId,
      type: itemType,
      placeId: dbPlace.id,
      sortOrder: (lastItem?.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath(`/trips/${tripId}`);
  // Lets ExploreClient record what was just added (sessionStorage) so the
  // trip page can highlight the new card on the next visit.
  return { itemId: item.id };
}

export type AnchorItemResult = {
  id: string;
  type: "HOTEL";
  place: {
    name: string;
    address: string | null;
    rating: number | null;
    country: string;
    provider: string;
    externalId: string;
    photoUrl: string | null;
    lat: number;
    lng: number;
  };
};

// "本日起點" (e.g. the hotel the day starts from) — a real timeline card
// (so it gets a photo, editable time/cost, and a real computed leg to the
// next stop via the normal auto-fill effect), always kept at sortOrder 0.
// TripDay.anchorItemId tracks which item this is, so optimizeStopOrder
// knows to keep it first instead of reordering it away (see
// src/lib/routeMode.ts), and so this can be updated in place (rather than
// creating a duplicate card) when the anchor is changed.
export async function setDayAnchor(
  tripId: string,
  dayId: string,
  place: NewPlaceInput,
  // Other day ids (not including dayId itself) to apply the same anchor
  // to — lets a multi-stop trip like "Hotel A day1-3, Hotel B day4-5,
  // Hotel A day6-7" be set without overwriting the days in between.
  applyToDayIds: string[]
): Promise<Record<string, AnchorItemResult>> {
  await requireTripEditor(tripId);
  const dbPlace = await prisma.place.upsert({
    where: {
      provider_externalId: {
        provider: place.provider,
        externalId: place.externalId,
      },
    },
    update: {
      photoUrl: place.photoUrl,
      ...(place.openHours ? { openHours: place.openHours } : {}),
      ...(place.suggestedType ? { suggestedType: place.suggestedType } : {}),
    },
    create: place,
  });

  const targetDayIds = [dayId, ...applyToDayIds];
  const targetDays = await prisma.tripDay.findMany({
    where: { tripId, id: { in: targetDayIds } },
    select: { id: true, anchorItemId: true },
  });

  const results: Record<string, AnchorItemResult> = {};

  await prisma.$transaction(async (tx) => {
    for (const day of targetDays) {
      const itemId = day.anchorItemId
        ? (
            await tx.item.update({
              where: { id: day.anchorItemId },
              data: { placeId: dbPlace.id },
            })
          ).id
        : await (async () => {
            const created = await tx.item.create({
              data: { dayId: day.id, type: "HOTEL", placeId: dbPlace.id, sortOrder: 0 },
            });
            await tx.tripDay.update({
              where: { id: day.id },
              data: { anchorItemId: created.id },
            });
            return created.id;
          })();

      results[day.id] = {
        id: itemId,
        type: "HOTEL",
        place: {
          name: dbPlace.name,
          address: dbPlace.address,
          rating: dbPlace.rating,
          country: dbPlace.country,
          provider: dbPlace.provider,
          externalId: dbPlace.externalId,
          photoUrl: dbPlace.photoUrl,
          lat: dbPlace.lat,
          lng: dbPlace.lng,
        },
      };
    }
  });

  revalidatePath(`/trips/${tripId}`);
  return results;
}

export async function clearDayAnchor(tripId: string, dayId: string) {
  await requireTripEditor(tripId);
  const day = await prisma.tripDay.findFirst({
    where: { id: dayId, tripId },
    select: { anchorItemId: true },
  });
  if (!day) redirect("/");
  if (day.anchorItemId) {
    await prisma.tripDay.update({
      where: { id: dayId },
      data: { anchorItemId: null },
    });
    await prisma.item.delete({ where: { id: day.anchorItemId } });
  }
  revalidatePath(`/trips/${tripId}`);
}

export async function addCollaborator(
  tripId: string,
  email: string,
  role: "EDITOR" | "VIEWER"
) {
  await requireTripOwner(tripId);
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) return;

  const user = await prisma.user.upsert({
    where: { email: trimmedEmail },
    update: {},
    create: { email: trimmedEmail, name: trimmedEmail.split("@")[0] },
  });

  await prisma.collaborator.upsert({
    where: { tripId_userId: { tripId, userId: user.id } },
    update: { role },
    create: { tripId, userId: user.id, role },
  });

  revalidatePath(`/trips/${tripId}`);
}

export async function removeCollaborator(tripId: string, userId: string) {
  await requireTripOwner(tripId);
  await prisma.collaborator.delete({
    where: { tripId_userId: { tripId, userId } },
  });
  revalidatePath(`/trips/${tripId}`);
}

// Turns on (or rotates, if already on) the share link — see the Trip model
// comment in schema.prisma. Generates a fresh token every time so
// re-enabling after a disable invalidates whatever link was out there
// before.
export async function enableTripShare(tripId: string, role: "EDITOR" | "VIEWER") {
  await requireTripOwner(tripId);
  const shareToken = randomUUID();
  await prisma.trip.update({
    where: { id: tripId },
    data: { shareEnabled: true, shareToken, shareRole: role },
  });
  revalidatePath(`/trips/${tripId}`);
  return shareToken;
}

export async function disableTripShare(tripId: string) {
  await requireTripOwner(tripId);
  await prisma.trip.update({
    where: { id: tripId },
    data: { shareEnabled: false, shareToken: null, shareRole: null },
  });
  revalidatePath(`/trips/${tripId}`);
}

// Changes what a link that's already out there grants, without rotating
// the token — so the owner can dial access up/down (e.g. 可編輯 → 僅檢視)
// without breaking a link they already sent someone.
export async function updateTripShareRole(tripId: string, role: "EDITOR" | "VIEWER") {
  await requireTripOwner(tripId);
  await prisma.trip.update({
    where: { id: tripId },
    data: { shareRole: role },
  });
  revalidatePath(`/trips/${tripId}`);
}

// Separate token/toggle from the collaborator share link above — this one
// gates the public, no-login "旅遊書" page (see src/app/journal/[token]).
// Owner-only, same as the other share settings.
export async function enableJournalShare(tripId: string) {
  await requireTripOwner(tripId);
  const journalShareToken = randomUUID();
  await prisma.trip.update({
    where: { id: tripId },
    data: { journalShareEnabled: true, journalShareToken },
  });
  revalidatePath(`/trips/${tripId}/settings`);
  return journalShareToken;
}

export async function disableJournalShare(tripId: string) {
  await requireTripOwner(tripId);
  await prisma.trip.update({
    where: { id: tripId },
    data: { journalShareEnabled: false, journalShareToken: null },
  });
  revalidatePath(`/trips/${tripId}/settings`);
}

export async function deleteItem(tripId: string, itemId: string) {
  await requireTripEditor(tripId);
  // Journal photo blobs won't be reachable once the cascade removes their
  // ItemPhoto rows — snapshot the URLs first (same trip scoping as the
  // delete below) so the files can be cleaned out of Blob storage too.
  const photos = await prisma.itemPhoto.findMany({
    where: { itemId, item: { day: { tripId } } },
    select: { url: true },
  });
  // If this item is some day's anchor card, unlink it first — TripDay's FK
  // to Item would otherwise block the delete, and this keeps the day's
  // "no anchor set" state consistent when the anchor card is removed via
  // its own delete button rather than "清除" in the anchor control.
  await prisma.tripDay.updateMany({
    where: { anchorItemId: itemId, tripId },
    data: { anchorItemId: null },
  });
  // deleteMany (not delete) so this scopes to tripId via the day relation —
  // an itemId belonging to another trip just deletes zero rows.
  const deleted = await prisma.item.deleteMany({ where: { id: itemId, day: { tripId } } });
  if (deleted.count > 0) {
    await deleteBlobsQuietly(photos.map((p) => p.url));
  }
  revalidatePath(`/trips/${tripId}`);
}

export type ItemTypeValue =
  | "PLACE"
  | "RESTAURANT"
  | "HOTEL"
  | "TRANSPORT"
  | "CUSTOM";

export type CostCategoryValue =
  | "TRANSPORT"
  | "FOOD"
  | "LODGING"
  | "TICKET"
  | "SHOPPING"
  | "OTHER";

export type ItemCostInput = {
  label: string | null;
  amount: number;
  currency: string;
  category: CostCategoryValue;
};

const COST_CATEGORY_VALUES = new Set<string>([
  "TRANSPORT",
  "FOOD",
  "LODGING",
  "TICKET",
  "SHOPPING",
  "OTHER",
]);
const MAX_COSTS_PER_ITEM = 20;
const MAX_COST_LABEL_LENGTH = 30;

// Server-side bounds regardless of what the modal enforces — every action
// here is reachable by direct POST. Invalid rows are dropped rather than
// failing the whole save (mirrors how the old single-cost path treated an
// unparseable amount as "no cost entered").
function sanitizeCosts(costs: ItemCostInput[]): ItemCostInput[] {
  return costs
    .filter(
      (c) =>
        Number.isFinite(c.amount) &&
        c.amount >= 0 &&
        COST_CATEGORY_VALUES.has(c.category)
    )
    .slice(0, MAX_COSTS_PER_ITEM)
    .map((c) => ({
      label: c.label?.trim().slice(0, MAX_COST_LABEL_LENGTH) || null,
      amount: c.amount,
      currency: c.currency.trim().slice(0, 8) || "TWD",
      category: c.category,
    }));
}

// Replace-all write for an item's cost entries (same pattern as
// saveRoutes): the modal always submits the full list, so diffing
// individual rows buys nothing.
function replaceCostsOps(itemId: string, costs: ItemCostInput[]) {
  return [
    prisma.itemCost.deleteMany({ where: { itemId } }),
    prisma.itemCost.createMany({
      data: costs.map((c, index) => ({
        itemId,
        label: c.label,
        amount: c.amount,
        currency: c.currency,
        category: c.category,
        sortOrder: index,
      })),
    }),
  ];
}

export async function updateItem(
  tripId: string,
  itemId: string,
  data: {
    type: ItemTypeValue;
    startTime: string | null;
    endTime: string | null;
    note: string | null;
    confirmationNumber: string | null;
    costs: ItemCostInput[];
  }
) {
  await requireTripEditor(tripId);
  // The costs writes below are keyed by itemId alone, so the item's
  // membership in this trip has to be proven first — updateMany's scoped
  // where can't protect them. Zero rows updated means the id isn't ours.
  const owned = await prisma.item.findFirst({
    where: { id: itemId, day: { tripId } },
    select: { id: true },
  });
  if (!owned) redirect("/");

  const costs = sanitizeCosts(data.costs);
  await prisma.$transaction([
    prisma.item.update({
      where: { id: itemId },
      data: {
        type: data.type,
        startTime: data.startTime ? new Date(data.startTime) : null,
        endTime: data.endTime ? new Date(data.endTime) : null,
        note: data.note?.trim() || null,
        confirmationNumber: data.confirmationNumber?.trim() || null,
      },
    }),
    ...replaceCostsOps(itemId, costs),
  ]);
  revalidatePath(`/trips/${tripId}`);
}

export async function addCustomItem(
  tripId: string,
  dayId: string,
  data: {
    type: ItemTypeValue;
    note: string;
    startTime: string | null;
    endTime: string | null;
    confirmationNumber: string | null;
    costs: ItemCostInput[];
  }
) {
  await requireTripEditor(tripId);
  await requireDayInTrip(tripId, dayId);
  const lastItem = await prisma.item.findFirst({
    where: { dayId },
    orderBy: { sortOrder: "desc" },
  });

  const costs = sanitizeCosts(data.costs);
  const item = await prisma.item.create({
    data: {
      dayId,
      type: data.type,
      note: data.note.trim() || null,
      startTime: data.startTime ? new Date(data.startTime) : null,
      endTime: data.endTime ? new Date(data.endTime) : null,
      confirmationNumber: data.confirmationNumber?.trim() || null,
      sortOrder: (lastItem?.sortOrder ?? 0) + 1,
      costs: {
        create: costs.map((c, index) => ({
          label: c.label,
          amount: c.amount,
          currency: c.currency,
          category: c.category,
          sortOrder: index,
        })),
      },
    },
  });

  revalidatePath(`/trips/${tripId}`);
  return { id: item.id };
}

export async function updateItemJournalText(
  tripId: string,
  itemId: string,
  journalText: string
) {
  await requireTripEditor(tripId);
  // updateMany (not update) so this scopes to tripId via the day relation —
  // an itemId belonging to another trip just updates zero rows.
  await prisma.item.updateMany({
    where: { id: itemId, day: { tripId } },
    // Server-side cap regardless of the textarea's own maxLength — the
    // action is reachable by direct POST with a payload of any size.
    data: { journalText: journalText.trim().slice(0, MAX_JOURNAL_TEXT_LENGTH) || null },
  });
  revalidatePath(`/trips/${tripId}`);
}

export type AddItemPhotoResult =
  | { ok: true; photo: { id: string; url: string } }
  | { ok: false; error: string };

export async function addItemPhoto(
  tripId: string,
  itemId: string,
  url: string
): Promise<AddItemPhotoResult> {
  await requireTripEditor(tripId);
  // Only accept URLs from this project's own Blob store — the client
  // normally passes back what /api/upload just returned, but nothing stops
  // a direct POST with an arbitrary string, which would otherwise get
  // rendered as an <img src> on the public journal page (hotlinking
  // whatever host the caller chose).
  if (!isOwnBlobUrl(url)) {
    return { ok: false, error: "圖片來源不正確，請重新上傳" };
  }

  // The item has no direct tripId column (only via day), so confirm
  // ownership with a scoped lookup before the create — ItemPhoto.create
  // has no `where` clause to scope through the way updateMany/deleteMany
  // do, so this check is the only thing standing between a caller who
  // supplies someone else's itemId and attaching a photo to that trip.
  const item = await prisma.item.findFirst({
    where: { id: itemId, day: { tripId } },
    select: {
      id: true,
      _count: { select: { photos: true } },
      photos: { select: { sortOrder: true }, orderBy: { sortOrder: "desc" }, take: 1 },
    },
  });
  if (!item) redirect("/");

  // The just-uploaded blob is deliberately NOT cleaned up on this reject:
  // deleting whatever URL a caller hands us on a failure path would let
  // anyone with editor rights on their own trip delete arbitrary blobs
  // they learned the URL of (e.g. another trip's photos) by intentionally
  // triggering this branch. The UI prevents reaching here normally by
  // disabling upload at the limit; a rare orphan beats a deletion oracle.
  if (item._count.photos >= MAX_PHOTOS_PER_ITEM) {
    return { ok: false, error: `一個項目最多 ${MAX_PHOTOS_PER_ITEM} 張照片` };
  }

  const photo = await prisma.itemPhoto.create({
    data: { itemId, url, sortOrder: (item.photos[0]?.sortOrder ?? -1) + 1 },
  });
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, photo: { id: photo.id, url: photo.url } };
}

export async function deleteItemPhoto(tripId: string, itemId: string, photoId: string) {
  await requireTripEditor(tripId);
  // Fetched (with the same trip scoping as the delete) before deleting so
  // the underlying blob file can be cleaned up too — DB rows cascade for
  // free, but Blob storage otherwise accumulates orphaned files forever.
  const photo = await prisma.itemPhoto.findFirst({
    where: { id: photoId, itemId, item: { day: { tripId } } },
    select: { url: true },
  });
  if (!photo) return;
  await prisma.itemPhoto.deleteMany({
    where: { id: photoId, itemId, item: { day: { tripId } } },
  });
  await deleteBlobsQuietly([photo.url]);
  revalidatePath(`/trips/${tripId}`);
}

export async function updateEmergencyInfo(tripId: string, text: string) {
  await requireTripEditor(tripId);
  await prisma.trip.update({
    where: { id: tripId },
    data: { emergencyInfo: text.trim() || null },
  });
  revalidatePath(`/trips/${tripId}`);
}

export async function updateTripCoverImage(
  tripId: string,
  coverImage: string | null
) {
  await requireTripEditor(tripId);
  const previous = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { coverImage: true },
  });
  const next = coverImage?.trim() || null;
  await prisma.trip.update({
    where: { id: tripId },
    data: { coverImage: next },
  });
  // A replaced uploaded cover is unreachable afterwards (nothing else
  // stores its URL), so clean up the blob file; deleteBlobsQuietly ignores
  // non-blob covers (place photos, pasted external URLs).
  if (previous?.coverImage && previous.coverImage !== next) {
    await deleteBlobsQuietly([previous.coverImage]);
  }
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/");
}

export async function deleteTrip(tripId: string) {
  await requireTripOwner(tripId);
  // Collected before the delete — the cascade wipes the ItemPhoto rows,
  // after which there'd be no record of which blob files belonged to this
  // trip and they'd leak in Blob storage forever.
  const [trip, photos] = await Promise.all([
    prisma.trip.findUnique({ where: { id: tripId }, select: { coverImage: true } }),
    prisma.itemPhoto.findMany({
      where: { item: { day: { tripId } } },
      select: { url: true },
    }),
  ]);
  await prisma.trip.delete({ where: { id: tripId } });
  await deleteBlobsQuietly([...photos.map((p) => p.url), trip?.coverImage]);
  revalidatePath("/");
  redirect("/");
}

// A trip's day count is unbounded on the client (a plain <input type="date">
// pair), and every day becomes a real TripDay row created up front — a
// typo'd year (2026 -> 2126) would otherwise silently create tens of
// thousands of rows instead of failing loudly.
const MAX_TRIP_DAYS = 180;

export type UpdateTripInfoResult = { ok: true } | { ok: false; error: string };

// Editing the date range after the trip already has TripDay rows is only
// safe in two shapes: a pure shift (day count unchanged — every existing
// day just gets its calendar date moved by the same delta, so dayIndex,
// items, routes, and the anchor all stay attached to the right day) or a
// full regenerate (day count changed, but only allowed when nothing has
// been scheduled yet, so there's nothing a day's identity needs to stay
// attached to). A day-count change once any Item exists would force
// picking which days to drop/add and what happens to their items — that's
// a decision only the user should make (by clearing the days themselves
// first), not something to guess at silently.
export async function updateTripInfo(
  tripId: string,
  title: string,
  startDateStr: string,
  endDateStr: string
): Promise<UpdateTripInfoResult> {
  await requireTripOwner(tripId);

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { ok: false, error: "請輸入行程名稱" };

  // Date-only strings parse as UTC midnight, matching how TripDay.date and
  // Trip.startDate/endDate are already stored (see createTrip).
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { ok: false, error: "請選擇有效的日期" };
  }
  if (endDate < startDate) {
    return { ok: false, error: "結束日期不能早於開始日期" };
  }

  const newDayCount =
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (newDayCount > MAX_TRIP_DAYS) {
    return {
      ok: false,
      error: `行程天數不能超過 ${MAX_TRIP_DAYS} 天，請確認日期是否正確`,
    };
  }

  const days = await prisma.tripDay.findMany({
    where: { tripId },
    orderBy: { dayIndex: "asc" },
    select: { id: true, _count: { select: { items: true } } },
  });
  const hasItems = days.some((d) => d._count.items > 0);

  if (hasItems && newDayCount !== days.length) {
    return {
      ok: false,
      error: "行程已經有排定的景點，無法調整總天數，請先清空多餘日期的行程內容再修改",
    };
  }

  if (newDayCount === days.length) {
    await prisma.$transaction([
      prisma.trip.update({ where: { id: tripId }, data: { title: trimmedTitle, startDate, endDate } }),
      ...days.map((day, i) =>
        prisma.tripDay.update({
          where: { id: day.id },
          data: { date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000) },
        })
      ),
    ]);
  } else {
    // Only reachable when hasItems is false, so dropping every existing
    // TripDay row and rebuilding from scratch can't lose any scheduled
    // content.
    await prisma.$transaction([
      prisma.tripDay.deleteMany({ where: { tripId } }),
      prisma.trip.update({
        where: { id: tripId },
        data: {
          title: trimmedTitle,
          startDate,
          endDate,
          days: {
            create: Array.from({ length: newDayCount }, (_, i) => ({
              date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
              dayIndex: i + 1,
            })),
          },
        },
      }),
    ]);
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/settings`);
  revalidatePath("/");
  return { ok: true };
}

export type CreateTripResult = { ok: false; error: string };

export async function createTrip(
  title: string,
  startDateStr: string,
  endDateStr: string
): Promise<CreateTripResult | void> {
  const owner = await requireUser();

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { ok: false, error: "請輸入行程名稱" };

  // Date-only strings ("YYYY-MM-DD") parse as UTC midnight per the Date
  // constructor spec — deliberately not appending a time/zone here so this
  // keeps matching how every TripDay.date is already stored.
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { ok: false, error: "請選擇有效的日期" };
  }
  if (endDate < startDate) {
    return { ok: false, error: "結束日期不能早於開始日期" };
  }

  const dayCount =
    Math.round(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
  if (dayCount > MAX_TRIP_DAYS) {
    return {
      ok: false,
      error: `行程天數不能超過 ${MAX_TRIP_DAYS} 天，請確認日期是否正確`,
    };
  }

  const trip = await prisma.trip.create({
    data: {
      ownerId: owner.id,
      title: trimmedTitle,
      startDate,
      endDate,
      status: "planning",
      days: {
        create: Array.from({ length: Math.max(dayCount, 1) }, (_, i) => ({
          date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
          dayIndex: i + 1,
        })),
      },
    },
  });

  // Only the generic template can seed at this point — there are no
  // places yet, so no country to match a destination template against
  // (see src/lib/checklistTemplates.ts). Destination items get added
  // later by re-calling this once the trip actually has places, via the
  // checklist tab's "補上目的地清單" button.
  await generateChecklistForTrip(trip.id);

  revalidatePath("/");
  redirect(`/trips/${trip.id}`);
}

type EkispertStationPoint = {
  Station?: { code?: string; Name?: string };
  Distance?: string;
};

type EkispertNearestStation = { code: string; name: string; walkMeters: number };

// Free plan's stationCount lets us list several candidate boarding stations
// per point (not just the closest one) — useful since the closest station
// isn't always the most convenient line.
const NEARBY_STATION_COUNT = 3;

async function findNearbyEkispertStations(
  key: string,
  lat: number,
  lng: number
): Promise<EkispertNearestStation[]> {
  const url = new URL("https://api.ekispert.jp/v1/json/geo/station");
  url.searchParams.set("key", key);
  url.searchParams.set("geoPoint", `${lat},${lng},wgs84,2000`);
  url.searchParams.set("stationCount", String(NEARBY_STATION_COUNT));

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data: {
    ResultSet?: { Point?: EkispertStationPoint | EkispertStationPoint[] };
  } = await res.json();
  const point = data.ResultSet?.Point;
  const points = Array.isArray(point) ? point : point ? [point] : [];
  return points.flatMap((p) => {
    const code = p.Station?.code;
    const name = p.Station?.Name;
    const walkMeters = p.Distance != null ? Number(p.Distance) : NaN;
    if (!code || !name || Number.isNaN(walkMeters)) return [];
    return [{ code, name, walkMeters }];
  });
}

type EkispertLine = { Name?: string };

// The line(s) serving a station, e.g. "福岡市地下鉄空港線" — free plan can't
// tell us which line a *route* takes, but it can tell us which lines each
// station itself sits on, which is enough to hint "same line, no transfer"
// vs. "different lines, you'll need to change trains", and to show which
// lines are boardable from each candidate station.
async function findStationLines(
  key: string,
  stationCode: string
): Promise<string[]> {
  const url = new URL("https://api.ekispert.jp/v1/json/station/info");
  url.searchParams.set("key", key);
  url.searchParams.set("code", stationCode);
  url.searchParams.set("type", "operationLine");

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data: {
    ResultSet?: { Information?: { Line?: EkispertLine | EkispertLine[] } };
  } = await res.json();
  const line = data.ResultSet?.Information?.Line;
  const lines = Array.isArray(line) ? line : line ? [line] : [];
  return lines.flatMap((l) => (l.Name ? [l.Name] : []));
}

export type JapanTransitStationHint = {
  name: string;
  walkMeters: number;
  lines: string[];
};

export type JapanTransitHint =
  | {
      ok: true;
      from: JapanTransitStationHint[];
      to: JapanTransitStationHint[];
      sameLine: boolean;
      externalUrl: string;
    }
  | { ok: false; error: string };

// Ekispert's free plan doesn't expose structured route data (durations,
// fares, departure times, transfer count — that's search/course/extreme
// and the timetable endpoints, which are paid-plan-only and reject
// free-plan keys outright; confirmed by testing and by Ekispert's own plan
// comparison page). What it does give us for free: several candidate
// boarding stations near each end (with walking distance), and every line
// each of those stations sits on. That's the most we can show in-app
// without sending the user to the external results page — actual
// timetables/fares still require that external link.
export async function getJapanTransitHint(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<JapanTransitHint> {
  // Unlike every other action here, this had no auth check at all — callable
  // anonymously to burn this project's Ekispert API quota.
  await requireUser();

  const key = process.env.EKISPERT_ACCESS_KEY;
  if (!key) {
    return { ok: false, error: "尚未設定 EKISPERT_ACCESS_KEY" };
  }

  try {
    const [fromStations, toStations] = await Promise.all([
      findNearbyEkispertStations(key, originLat, originLng),
      findNearbyEkispertStations(key, destLat, destLng),
    ]);
    if (fromStations.length === 0 || toStations.length === 0) {
      return { ok: false, error: "找不到附近的車站" };
    }

    const [fromLines, toLines] = await Promise.all([
      Promise.all(fromStations.map((s) => findStationLines(key, s.code))),
      Promise.all(toStations.map((s) => findStationLines(key, s.code))),
    ]);

    const from: JapanTransitStationHint[] = fromStations.map((s, i) => ({
      name: s.name,
      walkMeters: s.walkMeters,
      lines: fromLines[i],
    }));
    const to: JapanTransitStationHint[] = toStations.map((s, i) => ({
      name: s.name,
      walkMeters: s.walkMeters,
      lines: toLines[i],
    }));

    const linkUrl = new URL("https://api.ekispert.jp/v1/json/search/course/light");
    linkUrl.searchParams.set("key", key);
    linkUrl.searchParams.set("from", fromStations[0].code);
    linkUrl.searchParams.set("to", toStations[0].code);
    linkUrl.searchParams.set("searchType", "departure");
    const linkRes = await fetch(linkUrl.toString());
    const linkData: { ResultSet?: { ResourceURI?: string } } = linkRes.ok
      ? await linkRes.json()
      : {};

    const sameLine = from.some((f) =>
      to.some((t) => f.lines.some((line) => t.lines.includes(line)))
    );

    return {
      ok: true,
      from,
      to,
      sameLine,
      externalUrl: linkData.ResultSet?.ResourceURI ?? "",
    };
  } catch {
    return { ok: false, error: "查詢失敗，請稍後再試" };
  }
}
