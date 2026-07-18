import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Settings, CalendarDays, BookOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import TripDayBoard from "@/components/TripDayBoard";
import GoogleMapsProvider from "@/components/GoogleMapsProvider";
import CoverImagePicker from "@/components/CoverImagePicker";
import { AvatarStack } from "@/components/Avatar";
import { getCurrentUser } from "@/lib/auth";

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string; mode?: string }>;
}) {
  const { id } = await params;
  const { share: shareToken, mode: modeParam } = await searchParams;
  // Deep-link into a specific board mode (home's 行程健檢 hero button uses
  // ?mode=doctor) — whitelist because this feeds a client component prop.
  const initialMode =
    modeParam === "travel" || modeParam === "checklist" || modeParam === "doctor"
      ? modeParam
      : undefined;

  // getCurrentUser() (not requireUser()) and the trip query are independent
  // (both keyed off the request, not each other), so run them concurrently
  // instead of checking auth as a separate sequential round trip before
  // the trip loads.
  const [user, trip] = await Promise.all([
    getCurrentUser(),
    prisma.trip.findUnique({
      where: { id },
      // Prisma's default strategy runs one sequential query per relation
      // level (trip, owner, collaborators, days, items, places, routes —
      // 7 round trips for this shape). "join" collapses it into a single
      // SQL query, which is what actually made this page slow to load.
      relationLoadStrategy: "join",
      include: {
        owner: true,
        collaborators: { include: { user: true } },
        days: {
          orderBy: { dayIndex: "asc" },
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
              include: {
                place: true,
                photos: { orderBy: { sortOrder: "asc" } },
                costs: { orderBy: { sortOrder: "asc" } },
              },
            },
            routes: true,
          },
        },
        checklistItems: {
          orderBy: { sortOrder: "asc" },
          include: { assignedTo: true },
        },
      },
    }),
  ]);

  // Not requireUser(): a share link (/trips/[id]?share=...) needs to
  // survive a login round-trip, so on no session we redirect to /login
  // with `next` pointing back at this exact URL (including the share
  // token) instead of requireUser()'s unconditional redirect to "/".
  if (!user) {
    const nextPath = `/trips/${id}${shareToken ? `?share=${encodeURIComponent(shareToken)}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!trip) notFound();

  let role: "OWNER" | "EDITOR" | "VIEWER" | null =
    trip.ownerId === user.id
      ? "OWNER"
      : (trip.collaborators.find((c) => c.userId === user.id)?.role ?? null);

  // Auto-join as a real collaborator on a valid, currently-enabled share
  // link — the only other way onto this trip's collaborator list is the
  // owner typing an exact email into addCollaborator. Upsert (not create)
  // so opening the same link twice at once (e.g. two tabs) can't race into
  // a unique-constraint error. A stale/disabled/rotated token just falls
  // through to the no-role redirect below, same as never having a token.
  if (
    !role &&
    shareToken &&
    trip.shareEnabled &&
    trip.shareToken === shareToken &&
    trip.shareRole
  ) {
    await prisma.collaborator.upsert({
      where: { tripId_userId: { tripId: trip.id, userId: user.id } },
      update: {},
      create: { tripId: trip.id, userId: user.id, role: trip.shareRole },
    });
    role = trip.shareRole;
    trip.collaborators.push({
      tripId: trip.id,
      userId: user.id,
      role: trip.shareRole,
      createdAt: new Date(),
      user,
    });
  }

  if (!role) redirect("/");
  const isOwner = role === "OWNER";
  const canEdit = role !== "VIEWER";

  const collaborators = [
    {
      userId: trip.owner.id,
      name: trip.owner.name,
      email: trip.owner.email,
      avatarUrl: trip.owner.avatarUrl,
      role: "OWNER" as const,
    },
    ...trip.collaborators.map((c) => ({
      userId: c.user.id,
      name: c.user.name,
      email: c.user.email,
      avatarUrl: c.user.avatarUrl,
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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-700 hover:underline">
          ← 回我的行程
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href={`/trips/${trip.id}/journal`}
            aria-label="預覽旅遊書"
            title="預覽旅遊書"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-500 hover:bg-paper-alt hover:text-ink-700"
          >
            <BookOpen className="h-5 w-5" />
          </Link>
          <a
            href={`/trips/${trip.id}/ics`}
            aria-label="匯出行事曆"
            title="匯出行事曆（.ics）"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-500 hover:bg-paper-alt hover:text-ink-700"
          >
            <CalendarDays className="h-5 w-5" />
          </a>
          {isOwner && (
            <Link
              href={`/trips/${trip.id}/settings`}
              aria-label="行程設定"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-500 hover:bg-paper-alt hover:text-ink-700"
            >
              <Settings className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>

      <section className="relative mt-3 h-56 overflow-hidden rounded-card-lg shadow-soft sm:h-72">
        {!coverImage && (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-700" />
        )}
        <CoverImagePicker
          tripId={trip.id}
          tripTitle={trip.title}
          coverImage={coverImage}
          currentCoverImage={trip.coverImage}
          availablePhotos={availablePhotos}
          canEdit={canEdit}
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
            {/* "目前 Day" / 天氣 / 下一站 now live in TripDayBoard instead —
                they need to follow whichever Day Tab is selected, which is
                client state this server-rendered hero doesn't have. Static
                per-trip facts (dates, collaborators) stay here. */}
            {collaborators.length > 1 && (
              <span className="pointer-events-auto">
                <AvatarStack members={collaborators} />
              </span>
            )}
          </div>
        </div>
      </section>

      <GoogleMapsProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
        <div className="mt-8">
          <TripDayBoard
            tripId={trip.id}
            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
            initialMode={initialMode}
            collaborators={collaborators}
            emergencyInfo={trip.emergencyInfo}
            canEdit={canEdit}
            isOwner={isOwner}
            shareEnabled={trip.shareEnabled}
            shareToken={trip.shareToken}
            shareRole={trip.shareRole === "OWNER" ? null : trip.shareRole}
            journalShareEnabled={trip.journalShareEnabled}
            journalShareToken={trip.journalShareToken}
            checklistItems={trip.checklistItems.map((c) => ({
              id: c.id,
              title: c.title,
              category: c.category,
              note: c.note,
              isDone: c.isDone,
              assignedToId: c.assignedToId,
              assignedToName: c.assignedTo?.name ?? null,
              assignedToAvatarUrl: c.assignedTo?.avatarUrl ?? null,
              dueDate: c.dueDate ? c.dueDate.toISOString() : null,
              sortOrder: c.sortOrder,
            }))}
            days={trip.days.map((day) => ({
              id: day.id,
              dayIndex: day.dayIndex,
              date: day.date.toISOString().slice(0, 10),
              note: day.note,
              // Fetched client-side after the page loads (see TripDayBoard) —
              // open-meteo has no SLA and blocking SSR on it made every trip
              // page load wait on the slowest of N external calls.
              weather: null,
              anchorItemId: day.anchorItemId,
              timelineItems: day.items.map((item) => ({
                id: item.id,
                type: item.type,
                startTime: item.startTime,
                endTime: item.endTime,
                note: item.note,
                confirmationNumber: item.confirmationNumber,
                costs: item.costs.map((c) => ({
                  label: c.label,
                  amount: c.amount,
                  currency: c.currency,
                  category: c.category,
                })),
                journalText: item.journalText,
                photos: item.photos.map((photo) => ({ id: photo.id, url: photo.url })),
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
                      openHours: item.place.openHours,
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
                  photoUrl: item.place!.photoUrl,
                  startTime: item.startTime,
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
