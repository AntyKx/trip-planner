import Link from "next/link";
import { Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TripDayBoard from "@/components/TripDayBoard";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import { getDailyWeather, weatherLabel } from "@/lib/weather";
import DeleteTripButton from "@/components/DeleteTripButton";
import CoverImagePicker from "@/components/CoverImagePicker";
import { formatTime } from "@/lib/labels";
import { getNextStop } from "@/lib/timeline";
import { requireTripOwner } from "@/lib/auth";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      owner: true,
      collaborators: { include: { user: true } },
      days: {
        orderBy: { dayIndex: "asc" },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: { place: true },
          },
          routes: true,
        },
      },
    },
  });

  if (!trip) notFound();
  await requireTripOwner(trip.id);

  const collaborators = [
    { userId: trip.owner.id, name: trip.owner.name, email: trip.owner.email, role: "OWNER" as const },
    ...trip.collaborators.map((c) => ({
      userId: c.user.id,
      name: c.user.name,
      email: c.user.email,
      role: c.role,
    })),
  ];

  const allPlaces = trip.days
    .flatMap((day) => day.items)
    .map((item) => item.place)
    .filter((place): place is NonNullable<typeof place> => place !== null);

  const coverImage = trip.coverImage ?? allPlaces.find((p) => p.photoUrl)?.photoUrl;
  const availablePhotos = Array.from(
    new Set(allPlaces.map((p) => p.photoUrl).filter((url): url is string => !!url))
  );

  const dayWeather = await Promise.all(
    trip.days.map(async (day) => {
      const firstPlace = day.items.find((item) => item.place)?.place;
      if (!firstPlace) return null;
      return getDailyWeather(firstPlace.lat, firstPlace.lng, day.date);
    })
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentDayIndex = trip.days.findIndex(
    (d) => d.date.toISOString().slice(0, 10) === todayStr
  );
  const heroDayIndex = currentDayIndex >= 0 ? currentDayIndex : 0;
  const heroDay = trip.days[heroDayIndex];
  const heroWeather = dayWeather[heroDayIndex];
  const heroNextStop = heroDay ? getNextStop(heroDay.items) : null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm text-ink-700 hover:underline">
        ← 回我的行程
      </Link>

      <section className="relative mt-3 h-56 overflow-hidden rounded-2xl shadow-sm sm:h-72">
        {!coverImage && (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-700" />
        )}
        <CoverImagePicker
          tripId={trip.id}
          tripTitle={trip.title}
          coverImage={coverImage}
          currentCoverImage={trip.coverImage}
          availablePhotos={availablePhotos}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
          <h1 className="text-2xl font-bold drop-shadow-sm sm:text-3xl">
            {trip.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">
              {trip.startDate.toISOString().slice(0, 10)} ~{" "}
              {trip.endDate.toISOString().slice(0, 10)}
            </span>
            {heroDay && (
              <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">
                Day {heroDay.dayIndex}
              </span>
            )}
            {heroWeather && (
              <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">
                {weatherLabel(heroWeather.weatherCode).emoji}{" "}
                {Math.round(heroWeather.maxTemp)}° / {Math.round(heroWeather.minTemp)}°
              </span>
            )}
          </div>
          {heroNextStop && (
            <p className="mt-2 text-xs text-white/90 sm:text-sm">
              <span className="font-medium">下一站</span>{" "}
              {heroNextStop.place?.name ?? heroNextStop.note ?? "未命名項目"}
              {heroNextStop.startTime &&
                ` · ${formatTime(heroNextStop.startTime)}`}
            </p>
          )}
        </div>
      </section>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/explore?tripId=${trip.id}`}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            加入景點/餐廳
          </Link>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-ink-700">
            {trip.status}
          </span>
        </div>
        <DeleteTripButton tripId={trip.id} tripTitle={trip.title} />
      </div>

      <GoogleMapsProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
        <div className="mt-8">
          <TripDayBoard
            tripId={trip.id}
            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
            collaborators={collaborators}
            emergencyInfo={trip.emergencyInfo}
            days={trip.days.map((day, dayIdx) => ({
              id: day.id,
              dayIndex: day.dayIndex,
              date: day.date.toISOString().slice(0, 10),
              note: day.note,
              weather: dayWeather[dayIdx],
              timelineItems: day.items.map((item) => ({
                id: item.id,
                type: item.type,
                startTime: item.startTime,
                endTime: item.endTime,
                note: item.note,
                confirmationNumber: item.confirmationNumber,
                cost: item.cost,
                currency: item.currency,
                costCategory: item.costCategory,
                place: item.place
                  ? {
                      name: item.place.name,
                      address: item.place.address,
                      rating: item.place.rating,
                      country: item.place.country,
                      provider: item.place.provider,
                      externalId: item.place.externalId,
                      photoUrl: item.place.photoUrl,
                      lat: item.place.lat,
                      lng: item.place.lng,
                    }
                  : null,
              })),
              timelineRoutes: day.routes.map((route) => ({
                fromItemId: route.fromItemId,
                toItemId: route.toItemId,
                mode: route.mode,
                durationMin: route.durationMin,
                distanceKm: route.distanceKm,
                provider: route.provider,
              })),
              mapItems: day.items
                .filter((item) => item.place)
                .map((item) => ({
                  id: item.id,
                  name: item.place!.name,
                  lat: item.place!.lat,
                  lng: item.place!.lng,
                  type: item.type,
                  country: item.place!.country,
                })),
              mapRoutes: day.routes.map((route) => ({
                fromItemId: route.fromItemId,
                toItemId: route.toItemId,
                mode: route.mode,
              })),
            }))}
          />
        </div>
      </GoogleMapsProvider>
    </main>
  );
}
