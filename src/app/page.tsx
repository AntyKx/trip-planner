import Link from "next/link";
import { Plus, Luggage, MapPinned, LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { signOutAction } from "@/app/login/actions";

const FALLBACK_GRADIENTS = [
  "from-brand-500 to-brand-700",
  "from-accent-500 to-brand-600",
  "from-brand-400 to-accent-600",
];

// Keyed by the full Role enum for type-safety even though this only ever
// renders for a shared trip's collaborators[0] (see renderTripCard) — the
// owner never has their own Collaborator row, so "OWNER" shouldn't turn up
// here in practice.
const COLLAB_ROLE_LABEL: Record<"OWNER" | "EDITOR" | "VIEWER", string> = {
  OWNER: "擁有者",
  EDITOR: "可編輯",
  VIEWER: "僅檢視",
};

export default async function TripsPage() {
  const user = await requireUser();
  const trips = await prisma.trip.findMany({
    where: {
      OR: [{ ownerId: user.id }, { collaborators: { some: { userId: user.id } } }],
    },
    // See src/app/trips/[id]/page.tsx — "join" avoids Prisma's default
    // one-query-per-relation-level strategy.
    relationLoadStrategy: "join",
    // Explicit select (not include) — this card only ever renders a cover
    // photo and a couple of counts, so there's no reason to pull every
    // Item/Place column (rating, address, lat/lng, opening hours, ...) for
    // every trip just to find "the first item with a photo."
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      coverImage: true,
      collaborators: { where: { userId: user.id }, select: { role: true } },
      days: {
        select: {
          items: {
            orderBy: { sortOrder: "asc" },
            select: { place: { select: { photoUrl: true } } },
          },
        },
      },
    },
    orderBy: { startDate: "asc" },
  });

  // Trips that haven't ended yet (today or later) surface first, nearest
  // first — otherwise, once a few trips are in the past, they permanently
  // clog the top of a startDate-ascending list and the trip you're actually
  // about to take ends up buried further down every time this page loads.
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingTrips = trips.filter(
    (t) => t.endDate.toISOString().slice(0, 10) >= todayStr
  );
  const pastTrips = trips
    .filter((t) => t.endDate.toISOString().slice(0, 10) < todayStr)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

  function renderTripCard(trip: (typeof trips)[number]) {
    const coverImage =
      trip.coverImage ??
      trip.days
        .flatMap((day) => day.items)
        .find((item) => item.place?.photoUrl)?.place?.photoUrl;
    const itemCount = trip.days.reduce((sum, day) => sum + day.items.length, 0);
    const gradient =
      FALLBACK_GRADIENTS[trips.indexOf(trip) % FALLBACK_GRADIENTS.length];
    // Owner never has a Collaborator row for their own trip, so this is
    // only ever populated for a trip someone else shared with this user.
    const collabRole = trip.collaborators[0]?.role;

    return (
      <Link
        key={trip.id}
        href={`/trips/${trip.id}`}
        className="group relative block aspect-[16/9] w-full overflow-hidden rounded-2xl shadow-sm transition hover:shadow-lg sm:aspect-[21/9]"
      >
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt={trip.title}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradient}`}
          >
            <Luggage className="h-16 w-16 text-white/25" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

        {collabRole && (
          <div className="absolute right-3 top-3 flex gap-1.5">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-brand-700 backdrop-blur">
              共同編輯 · {COLLAB_ROLE_LABEL[collabRole]}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="truncate text-xl font-bold text-white drop-shadow-sm">
            {trip.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/90">
            <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">
              {trip.startDate.toISOString().slice(0, 10)} ~{" "}
              {trip.endDate.toISOString().slice(0, 10)}
            </span>
            <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">
              共 {trip.days.length} 天
            </span>
            <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">
              {itemCount} 個景點
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex items-center justify-end gap-3 text-sm text-ink-700">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700">
            {user.name.slice(0, 1)}
          </div>
        )}
        <span className="max-w-[8rem] truncate">{user.name}</span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-1 text-xs text-ink-500 hover:text-brand-600"
          >
            <LogOut className="h-3.5 w-3.5" />
            登出
          </button>
        </form>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">我的行程</h1>
        </div>
        <Link
          href="/trips/new"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          新增行程
        </Link>
      </div>

      <div className="mt-8 grid gap-5">
        {upcomingTrips.map(renderTripCard)}

        {pastTrips.length > 0 && (
          <h2 className="mt-3 text-sm font-medium text-ink-500">已結束的行程</h2>
        )}
        {pastTrips.map(renderTripCard)}

        {trips.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-16 text-center">
            <MapPinned className="h-10 w-10 text-brand-300" />
            <p className="text-sm text-ink-700">
              尚無行程，先建立第一個行程開始規劃旅行吧
            </p>
            <Link
              href="/trips/new"
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              新增行程
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
