import { Skeleton, TimelineItemSkeleton } from "@/components/LoadingSkeleton";

// Shown by Next.js while the Trip Detail server component's data fetch is
// in flight — mirrors the actual page's shape (hero, day tabs, timeline,
// sticky sidebar) instead of a blank screen.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <Skeleton className="h-5 w-20" />

      <div className="relative mt-3 h-56 overflow-hidden rounded-card-lg sm:h-72">
        <Skeleton className="h-full w-full !rounded-none" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex gap-2">
            <Skeleton className="h-20 w-24 shrink-0 rounded-card" />
            <Skeleton className="h-20 w-24 shrink-0 rounded-card" />
            <Skeleton className="h-20 w-24 shrink-0 rounded-card" />
          </div>
          <div className="mt-4">
            <TimelineItemSkeleton />
            <TimelineItemSkeleton />
            <TimelineItemSkeleton />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-28 w-full rounded-card" />
        </div>
      </div>
    </main>
  );
}
