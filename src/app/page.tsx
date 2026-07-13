import Link from "next/link";
import { Plus, Luggage, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatRelativeTime } from "@/lib/labels";
import { appButtonClassName } from "@/components/AppButton";
import { AvatarStack } from "@/components/Avatar";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import { NoTripsIllustration } from "@/components/EmptyStateIllustrations";
import GreetingHero from "@/components/GreetingHero";
import SignOutButton from "@/components/SignOutButton";

const FALLBACK_GRADIENTS = [
  "from-brand-500 to-brand-700",
  "from-accent-500 to-brand-600",
  "from-brand-400 to-accent-600",
];

// Keyed by the full Role enum for type-safety even though this only ever
// renders for a shared trip's collaborators (see renderTripCard) — the
// owner is never in the Collaborator table for their own trip, so "OWNER"
// shouldn't turn up here in practice.
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
    // Explicit select (not include) — trim to exactly what this card
    // renders instead of pulling every Item/Place column for every trip.
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      coverImage: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, avatarUrl: true } },
      collaborators: {
        select: { role: true, user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      days: {
        select: {
          items: {
            orderBy: { sortOrder: "asc" },
            select: { updatedAt: true, place: { select: { photoUrl: true } } },
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

  function renderTripCard(trip: (typeof trips)[number], index: number) {
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
    const collabRole = trip.collaborators.find((c) => c.user.id === user.id)?.role;
    // Owner first, then collaborators, for the avatar stack.
    const members = [trip.owner, ...trip.collaborators.map((c) => c.user)];
    const lastUpdatedMs = Math.max(
      trip.updatedAt.getTime(),
      ...trip.days.flatMap((d) => d.items).map((i) => i.updatedAt.getTime())
    );

    return (
      <Link
        key={trip.id}
        href={`/trips/${trip.id}`}
        style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
        className="group relative block aspect-[16/9] w-full animate-fade-up overflow-hidden rounded-card-lg opacity-0 shadow-soft transition [animation-fill-mode:forwards] hover:-translate-y-0.5 hover:shadow-lg sm:aspect-[21/9]"
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
          <div className="mt-2 flex items-center justify-between gap-2">
            {members.length > 1 ? (
              <AvatarStack members={members} />
            ) : (
              <span />
            )}
            <span className="text-[11px] text-white/70">
              {formatRelativeTime(new Date(lastUpdatedMs))}更新
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
        <SignOutButton />
      </div>

      <section className="mt-2">
        <GreetingHero name={user.name} />
        <h1 className="mt-1 text-3xl font-bold text-ink-900 sm:text-4xl">
          今天想規劃哪趟旅程？
        </h1>
        <Link
          href="/trips/new"
          className={appButtonClassName("primary", "md", "mt-4 gap-1.5")}
        >
          <Plus className="h-4 w-4" />
          新增旅程
        </Link>
      </section>

      {trips.length > 0 && (
        <SectionHeader title="近期旅程" icon={Luggage} className="mt-10 mb-5" />
      )}

      <div className="grid gap-5">
        {upcomingTrips.map(renderTripCard)}

        {trips.length === 0 && (
          <EmptyState
            illustration={<NoTripsIllustration />}
            title="尚無旅程"
            description="建立第一趟旅程，開始規劃你的下一次旅行"
            className="mt-4"
            action={
              <Link
                href="/trips/new"
                className={appButtonClassName("primary", "md", "mt-2 gap-1.5")}
              >
                <Plus className="h-4 w-4" />
                建立第一趟旅程
              </Link>
            }
          />
        )}
      </div>

      {pastTrips.length > 0 && (
        <details className="group mt-6">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-700">
            <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
            已結束的行程（{pastTrips.length}）
          </summary>
          <div className="mt-4 grid gap-5">{pastTrips.map(renderTripCard)}</div>
        </details>
      )}
    </main>
  );
}
