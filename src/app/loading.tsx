import { Skeleton, TripCardSkeleton } from "@/components/LoadingSkeleton";

// Shown by Next.js while the Home server component's data fetch is in
// flight (e.g. navigating back here from another page) — mirrors the
// actual page's shape (top-right user chip, hero heading, trip cards)
// instead of a blank screen.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex justify-end">
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-4 w-32" />
      <Skeleton className="mt-2 h-9 w-72" />
      <div className="mt-10 mb-5">
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="grid gap-5">
        <TripCardSkeleton />
        <TripCardSkeleton />
        <TripCardSkeleton />
      </div>
    </main>
  );
}
