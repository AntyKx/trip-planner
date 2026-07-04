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

export default async function TripsPage() {
  const user = await requireUser();
  const trips = await prisma.trip.findMany({
    where: { ownerId: user.id },
    // See src/app/trips/[id]/page.tsx — "join" avoids Prisma's default
    // one-query-per-relation-level strategy.
    relationLoadStrategy: "join",
    include: {
      days: {
        orderBy: { dayIndex: "asc" },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: { place: true },
          },
        },
      },
    },
    orderBy: { startDate: "asc" },
  });

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
        {trips.map((trip, index) => {
          const coverImage =
            trip.coverImage ??
            trip.days
              .flatMap((day) => day.items)
              .find((item) => item.place?.photoUrl)?.place?.photoUrl;
          const itemCount = trip.days.reduce((sum, day) => sum + day.items.length, 0);
          const gradient = FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length];

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

              <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-ink-700 backdrop-blur">
                {trip.status}
              </span>

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
        })}

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
