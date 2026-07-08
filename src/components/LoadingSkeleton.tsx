// Base pulsing placeholder block — compose these into page-specific
// skeletons (a few common ones are provided below) instead of every page
// hand-rolling its own animate-pulse divs.
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className ?? ""}`} />;
}

export function TripCardSkeleton() {
  return (
    <div className="aspect-[16/9] w-full overflow-hidden rounded-card-lg sm:aspect-[21/9]">
      <Skeleton className="h-full w-full !rounded-none" />
    </div>
  );
}

export function TimelineItemSkeleton() {
  return (
    <div className="mb-3 flex items-stretch gap-0 overflow-hidden rounded-xl border border-line bg-surface p-3">
      <Skeleton className="h-20 w-20 shrink-0 sm:w-28" />
      <div className="ml-3 flex-1 space-y-2 py-1">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function SearchResultSkeleton() {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-surface p-3">
      <Skeleton className="h-13 w-13 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
