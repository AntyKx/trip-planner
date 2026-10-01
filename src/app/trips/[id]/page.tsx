import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Settings, CalendarDays, BookOpen, ChevronLeft } from "lucide-react";
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
  searchParams: Promise<{ share?: string; mode?: string; open?: string }>;
}) {
  const { id } = await params;
  const { share: shareToken, mode: modeParam, open: openParam } = await searchParams;
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
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 sm:px-6 sm:pt-6">
      {/* 2026-10-01 restyle (B direction): edge-to-edge cover on phones
          with the back/journal/calendar/settings buttons on top of it,
          replacing a separate text row above a rounded cover card. */}
      <section className="relative -mx-4 h-60 overflow-hidden sm:mx-0 sm:h-72 sm:rounded-card-lg">
        {!coverImage && (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-800" />
        )}
        <CoverImagePicker
          tripId={trip.id}
          tripTitle={trip.title}
          coverImage={coverImage}
          currentCoverImage={trip.coverImage}
          availablePhotos={availablePhotos}
          canEdit={canEdit}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/25" />

        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
          <Link
            href="/"
            aria-label="回我的行程"
            title="回我的行程"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-ink-900 shadow-sm backdrop-blur hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/trips/${trip.id}/journal`}
              aria-label="預覽旅遊書"
              title="預覽旅遊書"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-ink-900 shadow-sm backdrop-blur hover:bg-white"
            >
              <BookOpen className="h-[18px] w-[18px]" />
            </Link>
            <a
              href={`/trips/${trip.id}/ics`}
              aria-label="匯出行事曆"
              title="匯出行事曆（.ics）"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-ink-900 shadow-sm backdrop-blur hover:bg-white"
            >
              <CalendarDays className="h-[18px] w-[18px]" />
            </a>
            {isOwner && (
              <Link
                href={`/trips/${trip.id}/settings`}
                aria-label="行程設定"
                title="行程設定"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-ink-900 shadow-sm backdrop-blur hover:bg-white"
              >
                <Settings className="h-[18px] w-[18px]" />
              </Link>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pr-24 text-white sm:p-6">
          <h1 className="text-2xl font-black drop-shadow-sm sm:text-3xl">{trip.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-white/90">
            <span className="tabular-nums">
              {trip.startDate.toISOString().slice(5, 10).replace("-", "/")} –{" "}
              {trip.endDate.toISOString().slice(5, 10).replace("-", "/")} · {trip.days.length} 天
            </span>
            {/* "目前 Day" / 天氣 / 下一站 live in TripDayBoard — they follow
                the selected Day Tab, client state this server-rendered
                header doesn't have. Static per-trip facts stay here. */}
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
            // Home onboarding step 3 (邀請同行的人) links here.
            initialSheet={openParam === "share" ? "share" : undefined}
            collaborators={collaborators}
            emergencyInfo={trip.emergencyInfo}
            canEdit={canEdit}
            isOwner={isOwner}
            shareEnabled={trip.shareEnabled}
            shareToken={trip.shareToken}
            shareRole={trip.shareRole === "OWNER" ? null : trip.shareRole}
            journalShareEnabled={trip.journalShareEnabled}
            journalShareToken={trip.journalShareToken}
            itineraryShareEnabled={trip.itineraryShareEnabled}
            itineraryShareToken={trip.itineraryShareToken}
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
                polyline: route.rawPolyline,
              })),
            }))}
          />
        </div>
      </GoogleMapsProvider>
    </main>
  );
}
