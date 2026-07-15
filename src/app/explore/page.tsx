import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import ExploreClient from "./ExploreClient";
import { getFavorites } from "./actions";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string; dayId?: string; view?: string }>;
}) {
  const { tripId, dayId, view } = await searchParams;
  const user = await requireUser();

  const editableBy = {
    OR: [
      { ownerId: user.id },
      { collaborators: { some: { userId: user.id, role: "EDITOR" as const } } },
    ],
  };
  // Only trips that haven't ended: an unfiltered startDate-ascending list
  // made trips[0] (the picker's default) the OLDEST trip — coming from the
  // home page's 探索景點 entry, that meant new places defaulted into a trip
  // that was already over — and the picker itself grew without bound as
  // finished trips piled up.
  const todayStart = new Date(new Date().toISOString().slice(0, 10));

  // Both independent of each other once we have the user, so run them
  // concurrently.
  const [trips, favorites] = await Promise.all([
    prisma.trip.findMany({
      where: { AND: [editableBy, { endDate: { gte: todayStart } }] },
      orderBy: { startDate: "asc" },
      include: { days: { orderBy: { dayIndex: "asc" } } },
    }),
    getFavorites(),
  ]);

  // A link from an already-ended trip's own page (加入景點/餐廳 passes
  // ?tripId=...) must still work even though that trip is filtered out
  // above — load just that one and append it.
  if (tripId && !trips.some((t) => t.id === tripId)) {
    const linkedTrip = await prisma.trip.findFirst({
      where: { AND: [editableBy, { id: tripId }] },
      include: { days: { orderBy: { dayIndex: "asc" } } },
    });
    if (linkedTrip) trips.push(linkedTrip);
  }

  return (
    <ExploreClient
      trips={trips.map((t) => ({
        id: t.id,
        title: t.title,
        days: t.days.map((d) => ({
          id: d.id,
          dayIndex: d.dayIndex,
          date: d.date.toISOString().slice(0, 10),
        })),
      }))}
      initialTripId={tripId}
      initialDayId={dayId}
      initialFavorites={favorites}
      initialView={view === "favorites" ? "favorites" : undefined}
    />
  );
}
