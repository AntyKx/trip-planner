import Link from "next/link";
import { cookies } from "next/headers";
import {
  Plus,
  Luggage,
  Compass,
  Heart,
  Stethoscope,
  CheckCircle2,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatRelativeTime } from "@/lib/labels";
import { footprintOf, tripHasJournal, tripPhotoCount, tripPlaceIds } from "@/lib/tripSummary";
import { detectBookingCity } from "@/lib/bookingLinks";
import BookingShortcuts from "@/components/BookingShortcuts";
import { appButtonClassName } from "@/components/AppButton";
import { AvatarStack } from "@/components/Avatar";
import ImgWithFallback from "@/components/ImgWithFallback";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import { NoTripsIllustration } from "@/components/EmptyStateIllustrations";
import GreetingHero from "@/components/GreetingHero";
import SignOutButton from "@/components/SignOutButton";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import OnboardingCard, {
  ONBOARDING_SKIP_COOKIE,
  type OnboardingStep,
} from "@/components/OnboardingCard";
import {
  MemoryCard,
  MemoriesRow,
  type MemoryTileTrip,
  FootprintStats,
  FavoritesPreview,
  InspirationChips,
} from "@/components/HomeSections";

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

// Derived from dates against today — Trip.status in the schema is dead
// (written once as "planning" on create, never read or updated), so the
// dates are the single source of truth here.
type TripStatus = "planning" | "soon" | "traveling" | "done";

const SOON_THRESHOLD_DAYS = 14;

const STATUS_CHIP: Record<TripStatus, { label: string; className: string }> = {
  planning: { label: "規劃中", className: "text-brand-700" },
  soon: { label: "即將出發", className: "text-accent-600" },
  traveling: { label: "旅行中", className: "text-emerald-700" },
  done: { label: "已完成", className: "text-ink-500" },
};

export default async function TripsPage() {
  const user = await requireUser();
  const [trips, favoriteCount, recentFavorites, cookieStore] = await Promise.all([
    prisma.trip.findMany({
    where: {
      OR: [{ ownerId: user.id }, { collaborators: { some: { userId: user.id } } }],
    },
    // See src/app/trips/[id]/page.tsx — "join" avoids Prisma's default
    // one-query-per-relation-level strategy.
    relationLoadStrategy: "join",
    // Explicit select (not include) — trim to exactly what this page
    // renders instead of pulling every Item/Place column for every trip.
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      coverImage: true,
      updatedAt: true,
      // Onboarding step 3 counts an enabled share link as "invited".
      shareEnabled: true,
      // "已公開" on the memory tiles.
      journalShareEnabled: true,
      owner: { select: { id: true, name: true, avatarUrl: true } },
      collaborators: {
        select: { role: true, user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      days: {
        select: {
          dayIndex: true,
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              updatedAt: true,
              // id/country feed the 旅行足跡 counts; photos the memory card.
              // address: 預訂捷徑 guesses the destination city from it.
              place: { select: { id: true, photoUrl: true, country: true, address: true } },
              _count: { select: { photos: true } },
              // Only to tell whether the 旅遊書 has anything in it.
              journalText: true,
            },
          },
        },
      },
      // Only the done flags — the hero's "檢查清單還有 N 項未完成" fact
      // needs a count, nothing else.
      checklistItems: { select: { isDone: true } },
    },
    orderBy: { startDate: "asc" },
    }),
    prisma.favorite.count({ where: { userId: user.id } }),
    prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { place: { select: { id: true, name: true, photoUrl: true } } },
    }),
    cookies(),
  ]);

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

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();

  function daysUntilStart(trip: (typeof trips)[number]): number {
    return Math.round((trip.startDate.getTime() - todayMs) / MS_PER_DAY);
  }

  function statusOf(trip: (typeof trips)[number]): TripStatus {
    const start = trip.startDate.toISOString().slice(0, 10);
    const end = trip.endDate.toISOString().slice(0, 10);
    if (end < todayStr) return "done";
    if (start <= todayStr) return "traveling";
    return daysUntilStart(trip) <= SOON_THRESHOLD_DAYS ? "soon" : "planning";
  }

  // The next trip gets the hero treatment; everything else stays in the
  // regular grid below (sliced so it doesn't appear twice).
  const heroTrip = upcomingTrips[0];

  function coverImageOf(trip: (typeof trips)[number]): string | undefined {
    return (
      trip.coverImage ??
      trip.days
        .flatMap((day) => day.items)
        .find((item) => item.place?.photoUrl)?.place?.photoUrl ??
      undefined
    );
  }

  function renderTripCard(trip: (typeof trips)[number], index: number) {
    const coverImage = coverImageOf(trip);
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
    const chip = STATUS_CHIP[statusOf(trip)];

    return (
      <Link
        key={trip.id}
        href={`/trips/${trip.id}`}
        style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
        className="group relative block aspect-[16/9] w-full animate-fade-up overflow-hidden rounded-card-lg opacity-0 shadow-soft transition [animation-fill-mode:forwards] hover:-translate-y-0.5 hover:shadow-lg sm:aspect-[21/9]"
      >
        <ImgWithFallback
          src={coverImage}
          alt={trip.title}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          fallback={
            <div
              className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradient}`}
            >
              <Luggage className="h-16 w-16 text-white/25" />
            </div>
          }
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

        <div className="absolute left-3 top-3">
          <span
            className={`rounded-full bg-white/90 px-3 py-1 text-xs font-medium backdrop-blur ${chip.className}`}
          >
            {chip.label}
          </span>
        </div>
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

  function renderHeroCard(trip: NonNullable<typeof heroTrip>) {
    const coverImage = coverImageOf(trip);
    const status = statusOf(trip);
    const daysToStart = daysUntilStart(trip);
    const currentDayIndex =
      Math.round((todayMs - trip.startDate.getTime()) / MS_PER_DAY) + 1;
    const countdown =
      status === "traveling"
        ? `旅行中 · Day ${currentDayIndex}`
        : daysToStart === 0
          ? "今天出發！"
          : `距離出發還有 ${daysToStart} 天`;

    // Derived facts only — no invented "completion %" (there's no data
    // model for what "complete" means; empty days and unchecked checklist
    // items are things the schema actually knows).
    const emptyDays = trip.days
      .filter((d) => d.items.length === 0)
      .map((d) => d.dayIndex)
      .sort((a, b) => a - b);
    const checklistRemaining = trip.checklistItems.filter((c) => !c.isDone).length;

    const facts: string[] = [];
    if (emptyDays.length > 0) {
      const shown = emptyDays.slice(0, 3).map((i) => `Day ${i}`).join("、");
      const suffix = emptyDays.length > 3 ? "…" : "";
      facts.push(
        `還有 ${emptyDays.length} 天尚未安排任何景點（${shown}${suffix}）`
      );
    }
    // A trip whose checklist was never seeded (0 rows) has nothing useful
    // to say — only surface a count when items actually exist.
    if (trip.checklistItems.length > 0 && checklistRemaining > 0) {
      facts.push(`檢查清單還有 ${checklistRemaining} 項未完成`);
    }

    return (
      <div className="animate-fade-up overflow-hidden rounded-card-lg border border-line bg-surface shadow-soft [animation-fill-mode:forwards]">
        <Link
          href={`/trips/${trip.id}`}
          className="group relative block h-44 sm:h-52"
        >
          <ImgWithFallback
            src={coverImage}
            alt={trip.title}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
            fallback={
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-800 via-brand-500 to-brand-300">
                <Luggage className="h-16 w-16 text-white/25" />
              </div>
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          <span className="absolute left-4 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-brand-700 backdrop-blur">
            {countdown}
          </span>
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h2 className="truncate text-2xl font-bold text-white drop-shadow-sm">
              {trip.title}
            </h2>
            <p className="mt-1 text-xs text-white/90">
              {trip.startDate.toISOString().slice(0, 10)} ~{" "}
              {trip.endDate.toISOString().slice(0, 10)}・共 {trip.days.length} 天
            </p>
          </div>
        </Link>

        <div className="flex flex-col gap-3 p-4">
          {facts.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {facts.map((fact) => (
                <li
                  key={fact}
                  className="flex items-start gap-2 text-sm text-ink-700"
                >
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500"
                    aria-hidden="true"
                  />
                  {fact}
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-success-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              行程都排好了，可以出發了！
            </p>
          )}
          <div className="flex gap-2.5">
            <Link
              href={`/trips/${trip.id}`}
              className={appButtonClassName("primary", "md", "flex-1")}
            >
              繼續規劃
            </Link>
            <Link
              href={`/trips/${trip.id}?mode=doctor`}
              className={appButtonClassName("secondary", "md", "gap-1.5")}
            >
              <Stethoscope className="h-4 w-4 text-brand-600" />
              行程健檢
            </Link>
          </div>
          <BookingShortcuts
            tripId={trip.id}
            startDate={trip.startDate.toISOString().slice(0, 10)}
            endDate={trip.endDate.toISOString().slice(0, 10)}
            detectedCity={
              detectBookingCity(
                trip.title,
                trip.days.flatMap((d) => d.items).map((i) => i.place?.address)
              )?.name
            }
            traveling={status === "traveling"}
          />
        </div>
      </div>
    );
  }

  // ---- Home blocks (see the merged-home rules agreed 2026-09-30) ----
  // One home page for everyone; each block decides for itself whether it
  // shows from the user's own data:
  //   top card   — next trip › (no trips at all: onboarding) › last trip
  //   onboarding — until all three steps are done or 略過 is pressed
  //   footprint  — whenever there are finished trips
  //   favourites / destination chips — only with no upcoming trip, where
  //     they fill in for the missing "next trip" instead of competing with it
  const lastTrip = !heroTrip ? pastTrips[0] : undefined;

  const ownedTrips = trips.filter((t) => t.owner.id === user.id);
  const stepTargetTrip = heroTrip ?? ownedTrips[0] ?? trips[0];
  const shareTargetTrip =
    (heroTrip && heroTrip.owner.id === user.id ? heroTrip : undefined) ?? ownedTrips[0];
  const onboardingSteps: OnboardingStep[] = [
    {
      title: "建立第一趟旅程",
      desc: "取個名字、選好日期",
      done: trips.length > 0,
      href: "/trips/new",
      cta: "建立",
    },
    {
      title: "加入景點或餐廳",
      desc: "從探索頁搜尋，或上傳截圖辨識",
      feature: "加好景點後，可以一鍵自動排時間、算交通，行程健檢也會幫你抓公休和衝突",
      done: trips.some((t) => t.days.some((d) => d.items.length > 0)),
      href: stepTargetTrip ? `/explore?tripId=${stepTargetTrip.id}` : "/explore",
      cta: "去加景點",
    },
    {
      title: "邀請同行的人",
      desc: "分享連結，一起編輯同一份行程",
      feature: "旅行結束後，還能把遊記和照片做成旅遊書分享",
      // Being on someone else's trip counts too — that's already
      // travelling with someone.
      done: trips.some((t) => t.collaborators.length > 0 || t.shareEnabled),
      href: shareTargetTrip ? `/trips/${shareTargetTrip.id}?open=share` : "/trips/new",
      cta: "邀請",
    },
  ];
  const onboardingSkipped = cookieStore.get(ONBOARDING_SKIP_COOKIE)?.value === "1";
  const showOnboarding = !onboardingSkipped && onboardingSteps.some((s) => !s.done);

  const footprint = footprintOf(pastTrips);

  function memoryTileOf(trip: (typeof trips)[number]): MemoryTileTrip {
    return {
      id: trip.id,
      title: trip.title,
      startDate: trip.startDate,
      endDate: trip.endDate,
      dayCount: trip.days.length,
      placeCount: tripPlaceIds(trip).size,
      photoCount: tripPhotoCount(trip),
      journalPublic: trip.journalShareEnabled,
      hasJournal: tripHasJournal(trip),
      coverImage: coverImageOf(trip),
    };
  }
  // The last trip already has its own big card when there's no upcoming
  // trip, so the row starts from the one before it in that case.
  const rowTrips = (lastTrip ? pastTrips.slice(1) : pastTrips).map(memoryTileOf);

  const quickEntries = [
    {
      href: "/explore",
      icon: Compass,
      title: "探索景點",
      desc: "搜尋並加入行程",
    },
    {
      href: "/trips/new",
      icon: Plus,
      title: "建立新旅程",
      desc: "從空白開始",
    },
    {
      href: "/explore?view=favorites",
      icon: Heart,
      title: "我的收藏",
      desc: "存過的口袋名單",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex items-center justify-end gap-3 text-sm text-ink-700">
        <PushNotificationToggle />
        <ImgWithFallback
          src={user.avatarUrl}
          alt={user.name}
          className="h-7 w-7 rounded-full object-cover"
          fallback={
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700">
              {user.name.slice(0, 1)}
            </div>
          }
        />
        <span className="max-w-[8rem] truncate">{user.name}</span>
        <SignOutButton />
      </div>

      <section className="mt-2">
        <GreetingHero name={user.name} />
      </section>

      {heroTrip && <section className="mt-6">{renderHeroCard(heroTrip)}</section>}
      {lastTrip && (
        <section className="mt-6">
          <MemoryCard trip={memoryTileOf(lastTrip)} />
        </section>
      )}
      {showOnboarding && (
        <section className="mt-6">
          <OnboardingCard steps={onboardingSteps} />
        </section>
      )}

      <section className="mt-5 grid grid-cols-3 gap-3">
        {quickEntries.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="rounded-card-lg bg-brand-50 px-2 py-3.5 text-center transition hover:bg-brand-100 active:scale-[0.97]"
          >
            <entry.icon className="mx-auto h-5 w-5 text-brand-600" />
            <span className="mt-1.5 block text-xs font-semibold text-brand-700">
              {entry.title}
            </span>
            <span className="mt-0.5 hidden text-[11px] text-ink-500 sm:block">
              {entry.desc}
            </span>
          </Link>
        ))}
      </section>

      {upcomingTrips.length > 1 && (
        <SectionHeader title="近期旅程" icon={Luggage} className="mt-10 mb-5" />
      )}

      <div className="grid gap-5">
        {upcomingTrips.slice(1).map(renderTripCard)}

        {/* Only once onboarding was skipped — otherwise that card already
            covers "no trips yet" and this would say the same thing twice. */}
        {trips.length === 0 && !showOnboarding && (
          <EmptyState
            illustration={<NoTripsIllustration />}
            title="你的下一段旅程，還沒開始書寫"
            description="建立旅程，開始收藏景點與安排每天的行程"
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

      {rowTrips.length > 0 && <MemoriesRow trips={rowTrips} total={pastTrips.length} />}

      {pastTrips.length > 0 && <FootprintStats {...footprint} />}

      {!heroTrip && favoriteCount > 0 && (
        <FavoritesPreview
          count={favoriteCount}
          places={recentFavorites.map((f) => f.place)}
        />
      )}

      {!heroTrip && <InspirationChips />}

    </main>
  );
}
