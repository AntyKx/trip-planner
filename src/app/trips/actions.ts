"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function reorderItems(
  tripId: string,
  dayId: string,
  orderedItemIds: string[]
) {
  await prisma.$transaction(
    orderedItemIds.map((id, index) =>
      prisma.item.update({ where: { id }, data: { sortOrder: index + 1 } })
    )
  );
  revalidatePath(`/trips/${tripId}`);
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
  await prisma.$transaction([
    prisma.route.deleteMany({ where: { dayId } }),
    ...routes.map((r) =>
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
};

export async function addPlaceToDay(
  tripId: string,
  dayId: string,
  itemType: "PLACE" | "RESTAURANT" | "HOTEL" | "CUSTOM",
  place: NewPlaceInput
) {
  const dbPlace = await prisma.place.upsert({
    where: {
      provider_externalId: {
        provider: place.provider,
        externalId: place.externalId,
      },
    },
    update: { photoUrl: place.photoUrl },
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

export async function addCollaborator(
  tripId: string,
  email: string,
  role: "EDITOR" | "VIEWER"
) {
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
  await prisma.collaborator.delete({
    where: { tripId_userId: { tripId, userId } },
  });
  revalidatePath(`/trips/${tripId}`);
}

export async function deleteItem(tripId: string, itemId: string) {
  await prisma.item.delete({ where: { id: itemId } });
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
  await prisma.item.update({
    where: { id: itemId },
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
  await prisma.trip.update({
    where: { id: tripId },
    data: { coverImage: coverImage?.trim() || null },
  });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/");
}

export async function deleteTrip(tripId: string) {
  await prisma.trip.delete({ where: { id: tripId } });
  revalidatePath("/");
  redirect("/");
}

export async function createTrip(formData: FormData) {
  const title = formData.get("title") as string;
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);

  let owner = await prisma.user.findFirst();
  if (!owner) {
    owner = await prisma.user.create({
      data: { name: "Anty", email: "antyk123@gmail.com" },
    });
  }

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

  revalidatePath("/");
  redirect(`/trips/${trip.id}`);
}

type EkispertStationPoint = {
  Station?: { code?: string; Name?: string };
  Distance?: string;
};

type EkispertNearestStation = { code: string; name: string; walkMeters: number };

async function findNearestEkispertStation(
  key: string,
  lat: number,
  lng: number
): Promise<EkispertNearestStation | null> {
  const url = new URL("https://api.ekispert.jp/v1/json/geo/station");
  url.searchParams.set("key", key);
  url.searchParams.set("geoPoint", `${lat},${lng},wgs84,2000`);
  url.searchParams.set("stationCount", "1");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data: {
    ResultSet?: { Point?: EkispertStationPoint | EkispertStationPoint[] };
  } = await res.json();
  const point = data.ResultSet?.Point;
  const first = Array.isArray(point) ? point[0] : point;
  const code = first?.Station?.code;
  const name = first?.Station?.Name;
  const walkMeters = first?.Distance != null ? Number(first.Distance) : NaN;
  if (!code || !name || Number.isNaN(walkMeters)) return null;
  return { code, name, walkMeters };
}

type EkispertLine = { Name?: string };

// The line serving a station, e.g. "福岡市地下鉄空港線" — free plan can't
// tell us which line a *route* takes, but it can tell us which line each
// station itself sits on, which is enough to hint "same line, no transfer"
// vs. "different lines, you'll need to change trains".
async function findStationLine(
  key: string,
  stationCode: string
): Promise<string | null> {
  const url = new URL("https://api.ekispert.jp/v1/json/station/info");
  url.searchParams.set("key", key);
  url.searchParams.set("code", stationCode);
  url.searchParams.set("type", "operationLine");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data: {
    ResultSet?: { Information?: { Line?: EkispertLine | EkispertLine[] } };
  } = await res.json();
  const line = data.ResultSet?.Information?.Line;
  const first = Array.isArray(line) ? line[0] : line;
  return first?.Name ?? null;
}

export type JapanTransitStationHint = {
  name: string;
  walkMeters: number;
  lineName?: string;
};

export type JapanTransitHint =
  | {
      ok: true;
      from: JapanTransitStationHint;
      to: JapanTransitStationHint;
      sameLine: boolean;
      externalUrl: string;
    }
  | { ok: false; error: string };

// Ekispert's free plan doesn't expose structured route data (durations,
// fares, transfer count — that's search/course/extreme, a paid-plan-only
// endpoint that rejects free-plan keys outright). What it does give us for
// free: the nearest station + walking distance on each end, and which line
// that station sits on. That's enough to show something useful in-app
// instead of a blind "open external site" link; the external Ekispert
// results page is still offered for the full itinerary/fare.
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
    const [fromStation, toStation] = await Promise.all([
      findNearestEkispertStation(key, originLat, originLng),
      findNearestEkispertStation(key, destLat, destLng),
    ]);
    if (!fromStation || !toStation) {
      return { ok: false, error: "找不到附近的車站" };
    }

    const [fromLine, toLine] = await Promise.all([
      findStationLine(key, fromStation.code),
      findStationLine(key, toStation.code),
    ]);

    const linkUrl = new URL("https://api.ekispert.jp/v1/json/search/course/light");
    linkUrl.searchParams.set("key", key);
    linkUrl.searchParams.set("from", fromStation.code);
    linkUrl.searchParams.set("to", toStation.code);
    linkUrl.searchParams.set("searchType", "departure");
    const linkRes = await fetch(linkUrl.toString());
    const linkData: { ResultSet?: { ResourceURI?: string } } = linkRes.ok
      ? await linkRes.json()
      : {};

    return {
      ok: true,
      from: {
        name: fromStation.name,
        walkMeters: fromStation.walkMeters,
        lineName: fromLine ?? undefined,
      },
      to: {
        name: toStation.name,
        walkMeters: toStation.walkMeters,
        lineName: toLine ?? undefined,
      },
      sameLine: !!fromLine && !!toLine && fromLine === toLine,
      externalUrl: linkData.ResultSet?.ResourceURI ?? "",
    };
  } catch {
    return { ok: false, error: "查詢失敗，請稍後再試" };
  }
}
