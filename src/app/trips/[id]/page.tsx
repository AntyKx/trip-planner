import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TripMap from "@/components/TripMap";
import TripDayTabs from "@/components/TripDayTabs";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import { COUNTRY_FLAG } from "@/lib/labels";
import { getDailyWeather } from "@/lib/weather";
import CollaboratorsPanel from "@/components/CollaboratorsPanel";
import DeleteTripButton from "@/components/DeleteTripButton";
import CoverImagePicker from "@/components/CoverImagePicker";

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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm text-slate-700 hover:underline">
        ← 回我的行程
      </Link>

      <CoverImagePicker
        tripId={trip.id}
        tripTitle={trip.title}
        coverImage={coverImage}
        currentCoverImage={trip.coverImage}
        availablePhotos={availablePhotos}
      />

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{trip.title}</h1>
          <p className="mt-1 text-sm text-slate-700">
            {trip.startDate.toISOString().slice(0, 10)} ~{" "}
            {trip.endDate.toISOString().slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/explore?tripId=${trip.id}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700"
          >
            + 加入景點/餐廳
          </Link>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            {trip.status}
          </span>
          <DeleteTripButton tripId={trip.id} tripTitle={trip.title} />
        </div>
      </div>

      <GoogleMapsProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        {/* Day timeline */}
        <div>
          <TripDayTabs
            tripId={trip.id}
            days={trip.days.map((day, dayIdx) => ({
              id: day.id,
              dayIndex: day.dayIndex,
              date: day.date.toISOString().slice(0, 10),
              weather: dayWeather[dayIdx],
              items: day.items.map((item) => ({
                id: item.id,
                type: item.type,
                startTime: item.startTime,
                note: item.note,
                place: item.place
                  ? {
                      name: item.place.name,
                      address: item.place.address,
                      rating: item.place.rating,
                      country: item.place.country,
                      provider: item.place.provider,
                      photoUrl: item.place.photoUrl,
                      lat: item.place.lat,
                      lng: item.place.lng,
                    }
                  : null,
              })),
              routes: day.routes.map((route) => ({
                fromItemId: route.fromItemId,
                toItemId: route.toItemId,
                mode: route.mode,
                durationMin: route.durationMin,
                distanceKm: route.distanceKm,
                provider: route.provider,
              })),
            }))}
          />
        </div>

        {/* Map panel */}
        <aside className="space-y-4 lg:sticky lg:top-10">
        <div className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">地圖</h3>
          <div className="mt-3">
            <TripMap
              apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
              days={trip.days.map((day) => ({
                id: day.id,
                dayIndex: day.dayIndex,
                items: day.items
                  .filter((item) => item.place)
                  .map((item) => ({
                    id: item.id,
                    name: item.place!.name,
                    lat: item.place!.lat,
                    lng: item.place!.lng,
                    type: item.type,
                  })),
                routes: day.routes.map((route) => ({
                  fromItemId: route.fromItemId,
                  toItemId: route.toItemId,
                  mode: route.mode,
                })),
              }))}
            />
          </div>
          <ul className="mt-4 space-y-2">
            {allPlaces.map((place) => (
              <li
                key={place.id}
                className="flex items-center gap-2 text-sm text-slate-600"
              >
                <span>{COUNTRY_FLAG[place.country] ?? "📍"}</span>
                <span className="flex-1">{place.name}</span>
                <span className="text-xs text-slate-600">
                  {place.lat.toFixed(3)}, {place.lng.toFixed(3)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <CollaboratorsPanel tripId={trip.id} collaborators={collaborators} />
        </aside>
      </div>
      </GoogleMapsProvider>
    </main>
  );
}
