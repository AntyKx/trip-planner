import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ItineraryOverview, {
  type ItineraryOverviewDay,
} from "@/components/ItineraryOverview";

// Public, no-login itinerary overview page — the token itself is the only
// credential, so this deliberately never touches getCurrentUser()/
// requireUser(), same convention as /journal/[token]. Unlisted but
// guessable-token content shouldn't end up in search results, hence the
// noindex below.
export const dynamic = "force-dynamic";

async function getItineraryTrip(token: string) {
  const trip = await prisma.trip.findFirst({
    where: { itineraryShareToken: token, itineraryShareEnabled: true },
    select: {
      title: true,
      startDate: true,
      endDate: true,
      coverImage: true,
      days: {
        orderBy: { dayIndex: "asc" },
        select: {
          id: true,
          dayIndex: true,
          date: true,
          anchorItemId: true,
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              type: true,
              startTime: true,
              place: {
                select: { name: true, address: true, rating: true, photoUrl: true },
              },
              routesFrom: {
                select: { toItemId: true, mode: true, durationMin: true, distanceKm: true },
              },
            },
          },
        },
      },
    },
  });
  if (!trip) return null;

  // routesFrom can (rarely, from before a leg got pruned/recomputed) hold
  // more than one row for an item — only the one that actually points at
  // whatever comes right after it in the current order is meaningful here.
  const days: ItineraryOverviewDay[] = trip.days.map((day) => ({
    id: day.id,
    dayIndex: day.dayIndex,
    date: day.date,
    anchorItemId: day.anchorItemId,
    items: day.items.map((item, index) => {
      const nextId = day.items[index + 1]?.id;
      const route = nextId
        ? item.routesFrom.find((r) => r.toItemId === nextId)
        : undefined;
      return {
        id: item.id,
        type: item.type,
        startTime: item.startTime,
        place: item.place,
        leg: route
          ? { mode: route.mode, durationMin: route.durationMin, distanceKm: route.distanceKm }
          : null,
      };
    }),
  }));

  return {
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    coverImage: trip.coverImage,
    days,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const trip = await getItineraryTrip(token);
  return {
    title: trip ? `${trip.title} · 行程總覽` : "行程總覽",
    robots: { index: false, follow: false },
  };
}

export default async function ItinerarySharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const trip = await getItineraryTrip(token);
  if (!trip) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl bg-paper px-4 pb-16 pt-8 sm:px-6">
      <ItineraryOverview trip={trip} />
    </main>
  );
}
