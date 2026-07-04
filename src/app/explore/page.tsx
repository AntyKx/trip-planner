import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import ExploreClient from "./ExploreClient";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string }>;
}) {
  const { tripId } = await searchParams;
  const user = await requireUser();

  const trips = await prisma.trip.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        {
          collaborators: {
            some: { userId: user.id, role: "EDITOR" },
          },
        },
      ],
    },
    orderBy: { startDate: "asc" },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });

  return (
    <ExploreClient
      trips={trips.map((t) => ({
        id: t.id,
        title: t.title,
        days: t.days.map((d) => ({ id: d.id, dayIndex: d.dayIndex })),
      }))}
      initialTripId={tripId}
    />
  );
}
