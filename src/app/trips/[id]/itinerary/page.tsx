import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTripRole } from "@/lib/auth";
import ItineraryOverview, {
  type ItineraryOverviewDay,
} from "@/components/ItineraryOverview";

// Signed-in preview of the "行程總覽" — same query shape/rendering as the
// public /itinerary/[token] page, just reached by tripId + session instead
// of the share token, so the owner/collaborators can see exactly what a
// public viewer would see without first turning sharing on.
export default async function ItineraryPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireTripRole(id);

  const trip = await prisma.trip.findUnique({
    where: { id },
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
  if (!trip) notFound();

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

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl bg-paper px-4 pb-16 pt-8 sm:px-6">
      <Link
        href={`/trips/${id}`}
        className="mb-3 flex items-center gap-1 text-sm text-ink-700 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        回行程
      </Link>
      <ItineraryOverview
        trip={{
          title: trip.title,
          startDate: trip.startDate,
          endDate: trip.endDate,
          coverImage: trip.coverImage,
          days,
        }}
      />
    </main>
  );
}
