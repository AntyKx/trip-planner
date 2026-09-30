import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { MemoryTile, type MemoryTileTrip } from "@/components/HomeSections";
import EmptyState from "@/components/EmptyState";
import {
  footprintOf,
  tripCover,
  tripHasJournal,
  tripPhotoCount,
  tripPlaceIds,
} from "@/lib/tripSummary";

// Every finished trip in one place, grouped by year. Replaced the home
// page's "旅行回憶（N）" fold, which stacked full-size 16:9 trip cards and
// sent each one to the editing page rather than the 旅遊書.
export default async function MemoriesPage() {
  const user = await requireUser();
  const todayStart = new Date(new Date().toISOString().slice(0, 10));

  const trips = await prisma.trip.findMany({
    where: {
      OR: [{ ownerId: user.id }, { collaborators: { some: { userId: user.id } } }],
      endDate: { lt: todayStart },
    },
    // See src/app/trips/[id]/page.tsx — "join" avoids Prisma's default
    // one-query-per-relation-level strategy.
    relationLoadStrategy: "join",
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      coverImage: true,
      journalShareEnabled: true,
      days: {
        select: {
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              place: { select: { id: true, photoUrl: true, country: true } },
              _count: { select: { photos: true } },
              journalText: true,
            },
          },
        },
      },
    },
  });

  const tiles: (MemoryTileTrip & { year: number })[] = trips.map((t) => ({
    id: t.id,
    title: t.title,
    startDate: t.startDate,
    endDate: t.endDate,
    dayCount: t.days.length,
    placeCount: tripPlaceIds(t).size,
    photoCount: tripPhotoCount(t),
    journalPublic: t.journalShareEnabled,
    hasJournal: tripHasJournal(t),
    coverImage: tripCover(t),
    year: t.startDate.getUTCFullYear(),
  }));
  const years = [...new Set(tiles.map((t) => t.year))];
  const stats = footprintOf(trips);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="inline-flex min-h-10 items-center gap-1 text-sm text-ink-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        首頁
      </Link>
      <h1 className="mt-1 text-3xl font-bold text-ink-900">旅行回憶</h1>
      {tiles.length > 0 && (
        <p className="mt-1 text-sm text-ink-500">
          {stats.trips} 趟旅程 · {stats.countries} 個國家 · {stats.places} 個景點 ·{" "}
          {stats.photos} 張照片
        </p>
      )}

      {tiles.length === 0 ? (
        <EmptyState
          title="還沒有結束的旅程"
          description="旅行結束後，行程會自動收進這裡，可以隨時翻回旅遊書"
          className="mt-10"
        />
      ) : (
        years.map((year) => (
          <section key={year} className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-ink-500 after:h-px after:flex-1 after:bg-line">
              {year}
            </h2>
            {/* minmax(0,1fr): a long title must truncate inside its tile,
                not widen the column (see the home favourites overflow). */}
            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
              {tiles
                .filter((t) => t.year === year)
                .map((t) => (
                  <MemoryTile key={t.id} trip={t} variant="grid" />
                ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
