"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { NewPlaceInput } from "@/app/trips/actions";
import type { PlaceResult } from "@/lib/places";

// "我的收藏" — a personal bucket-list independent of any trip, not shared
// with collaborators. Lets a place be saved while browsing and added to a
// trip/day later, from a dedicated favorites list, without needing a trip
// context at save time.

export async function addFavorite(place: NewPlaceInput) {
  const user = await requireUser();
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

  await prisma.favorite.upsert({
    where: { userId_placeId: { userId: user.id, placeId: dbPlace.id } },
    update: {},
    create: { userId: user.id, placeId: dbPlace.id },
  });
}

export async function removeFavorite(provider: string, externalId: string) {
  const user = await requireUser();
  const place = await prisma.place.findUnique({
    where: { provider_externalId: { provider, externalId } },
    select: { id: true },
  });
  if (!place) return;
  await prisma.favorite.deleteMany({ where: { userId: user.id, placeId: place.id } });
}

export async function getFavorites(): Promise<PlaceResult[]> {
  const user = await requireUser();
  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { place: true },
  });

  return favorites.map(({ place }): PlaceResult => ({
    externalId: place.externalId,
    name: place.name,
    address: place.address ?? "",
    lat: place.lat,
    lng: place.lng,
    rating: place.rating ?? undefined,
    priceLevel: place.priceLevel ?? undefined,
    category: place.category,
    photoUrl: place.photoUrl ?? undefined,
    suggestedType: place.suggestedType === "RESTAURANT" ? "RESTAURANT" : "PLACE",
    country: place.country === "TW" ? "TW" : "JP",
  }));
}
