import Link from "next/link";
import { Plus, Luggage } from "lucide-react";
import { prisma } from "@/lib/prisma";

export default async function TripsPage() {
  const trips = await prisma.trip.findMany({
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">我的行程</h1>
          <p className="mt-1 text-sm text-slate-700">
            旅遊規劃 APP 原型 — 資料來自 Prisma + SQLite
          </p>
        </div>
        <Link
          href="/trips/new"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          新增行程
        </Link>
      </div>

      <div className="mt-8 grid gap-4">
        {trips.map((trip) => {
          const coverImage =
            trip.coverImage ??
            trip.days
              .flatMap((day) => day.items)
              .find((item) => item.place?.photoUrl)?.place?.photoUrl;

          return (
            <Link
              key={trip.id}
              href={`/trips/${trip.id}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              {coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverImage}
                  alt={trip.title}
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <Luggage className="h-6 w-6 text-slate-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate text-lg font-semibold text-slate-900">
                    {trip.title}
                  </h2>
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {trip.status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-slate-700">
                  {trip.startDate.toISOString().slice(0, 10)} ~{" "}
                  {trip.endDate.toISOString().slice(0, 10)} · 共 {trip.days.length} 天
                </p>
              </div>
            </Link>
          );
        })}

        {trips.length === 0 && (
          <p className="text-sm text-slate-700">
            尚無行程，請先執行 <code>npm run seed</code> 建立範例資料。
          </p>
        )}
      </div>
    </main>
  );
}
