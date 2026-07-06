"use server";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, requireTripEditor, requireTripOwner } from "@/lib/auth";
import { getDailyWeather, type DailyWeather } from "@/lib/weather";
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

  await prisma.item.create({
    data: {
      dayId,
      type: itemType,
      placeId: dbPlace.id,
      sortOrder: (lastItem?.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath(`/trips/${tripId}`);
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

export async function deleteItem(tripId: string, itemId: string) {
  await requireTripEditor(tripId);
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
  await prisma.item.deleteMany({ where: { id: itemId, day: { tripId } } });
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

export async function updateItem(
  tripId: string,
  itemId: string,
  data: {
    type: ItemTypeValue;
    startTime: string | null;
    endTime: string | null;
    note: string | null;
    confirmationNumber: string | null;
    cost: number | null;
    currency: string | null;
    costCategory: CostCategoryValue | null;
  }
) {
  await requireTripEditor(tripId);
  // updateMany (not update) so this scopes to tripId via the day relation —
  // an itemId belonging to another trip just updates zero rows.
  await prisma.item.updateMany({
    where: { id: itemId, day: { tripId } },
    data: {
      type: data.type,
      startTime: data.startTime ? new Date(data.startTime) : null,
      endTime: data.endTime ? new Date(data.endTime) : null,
      note: data.note?.trim() || null,
      confirmationNumber: data.confirmationNumber?.trim() || null,
      cost: data.cost,
      currency: data.cost != null ? data.currency : null,
      costCategory: data.cost != null ? data.costCategory : null,
    },
  });
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
    cost: number | null;
    currency: string | null;
    costCategory: CostCategoryValue | null;
  }
) {
  await requireTripEditor(tripId);
  await requireDayInTrip(tripId, dayId);
  const lastItem = await prisma.item.findFirst({
    where: { dayId },
    orderBy: { sortOrder: "desc" },
  });

  const item = await prisma.item.create({
    data: {
      dayId,
      type: data.type,
      note: data.note.trim() || null,
      startTime: data.startTime ? new Date(data.startTime) : null,
      endTime: data.endTime ? new Date(data.endTime) : null,
      confirmationNumber: data.confirmationNumber?.trim() || null,
      cost: data.cost,
      currency: data.cost != null ? data.currency : null,
      costCategory: data.cost != null ? data.costCategory : null,
      sortOrder: (lastItem?.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath(`/trips/${tripId}`);
  return { id: item.id };
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
  await prisma.trip.update({
    where: { id: tripId },
    data: { coverImage: coverImage?.trim() || null },
  });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/");
}

export async function deleteTrip(tripId: string) {
  await requireTripOwner(tripId);
  await prisma.trip.delete({ where: { id: tripId } });
  revalidatePath("/");
  redirect("/");
}

export async function createTrip(formData: FormData) {
  const owner = await requireUser();
  const title = formData.get("title") as string;
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);

  const dayCount =
    Math.round(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

  const trip = await prisma.trip.create({
    data: {
      ownerId: owner.id,
      title,
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
