import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import ExploreClient from "./ExploreClient";
import { getFavorites } from "./actions";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string; dayId?: string }>;
}) {
  const { tripId, dayId } = await searchParams;
  const user = await requireUser();

  // Both independent of each other once we have the user, so run them
  // concurrently.
  const [trips, favorites] = await Promise.all([
    prisma.trip.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { collaborators: { some: { userId: user.id, role: "EDITOR" } } },
        ],
      },
      orderBy: { startDate: "asc" },
      include: { days: { orderBy: { dayIndex: "asc" } } },
    }),
    getFavorites(),
  ]);

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
    />
  );
}
