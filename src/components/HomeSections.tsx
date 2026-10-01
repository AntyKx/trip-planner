import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Footprints,
  Globe,
  Heart,
  Images,
  ListChecks,
  Luggage,
  Map as MapIcon,
  Plus,
  Stethoscope,
} from "lucide-react";
import ImgWithFallback from "./ImgWithFallback";
import SectionHeader from "./SectionHeader";
import { appButtonClassName } from "./AppButton";
import { formatRelativeTime } from "@/lib/labels";
import type { RankedDestination } from "@/lib/inspiration";

// Sections the home page shows when there's no upcoming trip to anchor it
// (see the block rules in src/app/page.tsx). All figures come from the
// user's own data — nothing here is invented or "recommended".

export function MemoryCard({
  trip,
}: {
  trip: {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
    dayCount: number;
    placeCount: number;
    photoCount: number;
    hasJournal: boolean;
    coverImage?: string;
  };
}) {
  const meta = [
    `${trip.startDate.toISOString().slice(0, 10)} ~ ${trip.endDate.toISOString().slice(0, 10)}`,
    `${trip.dayCount} 天`,
    trip.placeCount > 0 ? `${trip.placeCount} 個景點` : null,
    trip.photoCount > 0 ? `${trip.photoCount} 張照片` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative animate-fade-up overflow-hidden rounded-card-lg shadow-soft [animation-fill-mode:forwards]">
      <ImgWithFallback
        src={trip.coverImage}
        alt={trip.title}
        className="absolute inset-0 h-full w-full object-cover"
        fallback={
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-800">
            <Luggage className="h-16 w-16 text-white/25" />
          </div>
        }
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
      <div className="relative flex min-h-48 flex-col justify-end p-4 text-white sm:min-h-56">
        <p className="text-xs tracking-wide text-white/85">
          上一趟旅程・{formatRelativeTime(trip.endDate)}結束
        </p>
        <h2 className="mt-0.5 truncate text-2xl font-bold drop-shadow-sm">{trip.title}</h2>
        <p className="mt-1 text-xs text-white/90">{meta}</p>
        <div className="mt-3 flex gap-2">
          {trip.hasJournal && (
            <Link
              href={`/trips/${trip.id}/journal`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-white px-3.5 text-sm font-bold text-ink-900 transition active:scale-[0.97]"
            >
              <BookOpen className="h-4 w-4" />
              翻翻旅遊書
            </Link>
          )}
          <Link
            href={`/trips/${trip.id}`}
            className={`inline-flex min-h-10 items-center rounded-lg px-3.5 text-sm font-medium transition active:scale-[0.97] ${
              trip.hasJournal ? "bg-white/20 text-white backdrop-blur" : "bg-white text-ink-900"
            }`}
          >
            看行程
          </Link>
        </div>
      </div>
    </div>
  );
}

export function FootprintStats({
  countries,
  trips,
  places,
}: {
  countries: number;
  trips: number;
  places: number;
}) {
  const stats = [
    { value: countries, label: "個國家" },
    { value: trips, label: "趟旅程" },
    { value: places, label: "個景點" },
  ];
  return (
    <section className="mt-10">
      <SectionHeader title="你的旅行足跡" icon={Footprints} className="mb-4" />
      <Link
        href="/memories"
        aria-label="你的旅行足跡，查看全部旅行回憶"
        className="grid grid-cols-3 rounded-card-lg border border-line bg-surface py-4 transition hover:shadow-soft"
      >
        {stats.map((s) => (
          <div key={s.label} className="border-r border-line text-center last:border-r-0">
            <p className="text-2xl font-bold text-ink-900 tabular-nums">{s.value}</p>
            <p className="text-xs text-ink-500">{s.label}</p>
          </div>
        ))}
      </Link>
    </section>
  );
}

export function FavoritesPreview({
  count,
  places,
}: {
  count: number;
  places: { id: string; name: string; photoUrl: string | null }[];
}) {
  return (
    <section className="mt-10">
      <SectionHeader
        title="收藏清單"
        icon={Heart}
        className="mb-4"
        action={
          <Link href="/explore?view=favorites" className="text-sm text-brand-600 hover:underline">
            查看全部
          </Link>
        }
      />
      {/* flex-col, not grid: a grid item's default min-width is its
          content, so the long nowrap name list below widened the card (and
          the whole page) past the screen instead of truncating. */}
      <div className="flex flex-col gap-3 rounded-card-lg border border-line bg-surface p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0">
            {places.map((p, i) => (
              <ImgWithFallback
                key={p.id}
                src={p.photoUrl}
                alt={p.name}
                className={`h-11 w-11 rounded-lg border-2 border-white object-cover shadow-sm ${i > 0 ? "-ml-2.5" : ""}`}
                fallback={
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 border-white bg-brand-50 shadow-sm ${i > 0 ? "-ml-2.5" : ""}`}
                  >
                    <Heart className="h-4 w-4 text-brand-400" />
                  </div>
                }
              />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900">你收藏了 {count} 個地點</p>
            <p className="truncate text-xs text-ink-500">
              {places.map((p) => p.name).join("、")}
              {count > places.length ? "…" : ""}
            </p>
          </div>
        </div>
        {/* No "import favourites into a new trip" feature exists yet —
            this just starts a trip; adding the saved places happens from
            the explore page's 收藏 tab afterwards. */}
        <Link href="/trips/new" className={appButtonClassName("secondary", "md", "w-full")}>
          <Plus className="h-4 w-4 text-brand-600" />
          用收藏開一趟新旅程
        </Link>
      </div>
    </section>
  );
}

function destinationHref(d: RankedDestination) {
  const params = new URLSearchParams({ q: `${d.city} 景點`, region: d.region });
  if (d.region === "OTHER") params.set("area", d.country);
  return `/explore?${params.toString()}`;
}

// The hand-picked destination list, re-ordered by season, the next Taiwan
// long weekend and the user's own past trips (see @/lib/inspiration).
// Still labelled 精選清單 — it's a fixed list, just sorted, never a
// personalised recommendation.
export function InspirationChips({
  month,
  destinations,
  longWeekend,
}: {
  month: number;
  destinations: RankedDestination[];
  longWeekend?: { start: string; end: string; name: string; days: number };
}) {
  const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  return (
    <section className="mt-10">
      <SectionHeader
        title={`${month} 月適合去`}
        icon={MapIcon}
        className="mb-1.5"
        action={<span className="text-xs text-ink-400">精選清單</span>}
      />
      <p className="mb-4 text-xs text-ink-500">
        {longWeekend
          ? `下個連假：${md(longWeekend.start)}–${md(longWeekend.end)} ${longWeekend.name}（${longWeekend.days} 天）・依季節、連假和你去過的地方排序`
          : "依季節和你去過的地方排序"}
      </p>
      {/* Two-column tiles instead of pill chips (2026-10-01 restyle). */}
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
        {destinations.map((d) => (
          <Link
            key={d.city}
            href={destinationHref(d)}
            className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-line bg-surface px-3 py-2.5 transition hover:border-brand-200 hover:bg-brand-50"
          >
            <span className="flex items-center justify-between gap-1">
              <span className="truncate text-[15px] font-bold text-ink-900">{d.city}</span>
              {d.visited && (
                <span className="shrink-0 rounded bg-paper-alt px-1.5 text-[10.5px] text-ink-500">
                  去過
                </span>
              )}
            </span>
            <span className="truncate text-xs text-ink-500">{d.reason ?? d.country}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export type MemoryTileTrip = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  dayCount: number;
  placeCount: number;
  photoCount: number;
  journalPublic: boolean;
  hasJournal: boolean;
  coverImage?: string;
};

// One finished trip. The tile itself opens the 旅遊書 — after the trip
// that's what people come back for — and the small corner button is the
// way into the (editing) trip page. The two links are siblings, not
// nested, since an <a> inside an <a> is invalid. A trip with no journal
// entries or photos would open an empty book, so its tile goes straight
// to the trip page and the corner button is dropped.
export function MemoryTile({ trip, variant }: { trip: MemoryTileTrip; variant: "row" | "grid" }) {
  const tileHref = trip.hasJournal ? `/trips/${trip.id}/journal` : `/trips/${trip.id}`;
  const cover = (
    <ImgWithFallback
      src={trip.coverImage}
      alt={trip.title}
      className="absolute inset-0 h-full w-full object-cover"
      fallback={
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-400 to-brand-700">
          <Luggage className="h-10 w-10 text-white/25" />
        </div>
      }
    />
  );
  const itineraryButton = trip.hasJournal && (
    <Link
      href={`/trips/${trip.id}`}
      aria-label={`看「${trip.title}」的行程`}
      title="看行程"
      className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-ink-700 shadow-sm backdrop-blur hover:bg-white"
    >
      <ListChecks className="h-4 w-4" />
    </Link>
  );

  if (variant === "row") {
    return (
      <div className="relative w-[132px] shrink-0 snap-start">
        <Link href={tileHref} className="group block">
          <div className="relative h-[160px] overflow-hidden rounded-card-lg bg-paper-alt">
            {cover}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <p className="absolute inset-x-2.5 bottom-6 truncate text-[15px] font-bold text-white">
              {trip.title}
            </p>
            <p className="absolute left-2.5 bottom-2 text-[11px] text-white/85 tabular-nums">
              {trip.startDate.toISOString().slice(0, 7).replace("-", "/")}
            </p>
          </div>
          <p className="mt-1.5 flex items-center gap-1 truncate text-[11.5px] text-ink-500">
            {trip.dayCount} 天
            {trip.photoCount > 0 && (
              <>
                {" · "}
                <Images className="h-3 w-3 shrink-0" />
                {trip.photoCount}
              </>
            )}
            {trip.journalPublic && <span className="text-success-700"> · 已公開</span>}
          </p>
        </Link>
        {itineraryButton}
      </div>
    );
  }

  return (
    <div className="relative min-w-0">
      <Link
        href={tileHref}
        className="flex h-full flex-col overflow-hidden rounded-card-lg border border-line bg-surface transition hover:shadow-soft"
      >
        <div className="relative h-28 shrink-0 bg-paper-alt">{cover}</div>
        <div className="flex min-w-0 flex-col gap-0.5 px-2.5 pb-3 pt-2">
          <p className="truncate text-[14.5px] font-bold text-ink-900">{trip.title}</p>
          <p className="text-[11.5px] text-ink-500 tabular-nums">
            {trip.startDate.toISOString().slice(0, 10).replaceAll("-", "/")} –{" "}
            {trip.endDate.toISOString().slice(5, 10).replace("-", "/")}
          </p>
          <p className="text-[11.5px] text-ink-700">
            {trip.dayCount} 天 · {trip.placeCount} 景點 · {trip.photoCount} 張照片
          </p>
          {!trip.hasJournal ? (
            <p className="text-[11px] text-ink-400">還沒有遊記</p>
          ) : trip.journalPublic ? (
            <p className="flex items-center gap-1 text-[11px] text-success-700">
              <Globe className="h-3 w-3" />
              旅遊書已公開
            </p>
          ) : (
            <p className="text-[11px] text-ink-400">旅遊書未公開</p>
          )}
        </div>
      </Link>
      {itineraryButton}
    </div>
  );
}

const ROW_LIMIT = 6;

export function MemoriesRow({ trips, total }: { trips: MemoryTileTrip[]; total: number }) {
  return (
    <section className="mt-10">
      <SectionHeader
        title="旅行回憶"
        icon={BookOpen}
        className="mb-4"
        action={
          <Link href="/memories" className="flex items-center text-sm text-brand-600 hover:underline">
            查看全部
            <ChevronRight className="h-4 w-4" />
          </Link>
        }
      />
      <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none] sm:-mx-6 sm:px-6">
        {trips.slice(0, ROW_LIMIT).map((t) => (
          <MemoryTile key={t.id} trip={t} variant="row" />
        ))}
        <Link
          href="/memories"
          className="flex h-[160px] w-[110px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-card-lg border border-line bg-paper-alt text-sm font-medium text-brand-700"
        >
          <ListChecks className="h-5 w-5" />
          查看全部
          <span className="text-xs font-normal text-ink-500">{total} 趟</span>
        </Link>
      </div>
    </section>
  );
}

// The next upcoming (or ongoing) trip at the top of the home page —
// 2026-10-01 restyle (B direction): a solid brand-colour banner with a big
// countdown, replacing the old photo card; the derived facts become orange
// reminder strips under it, followed by `children` (預訂捷徑).
export function NextTripBanner({
  tripId,
  title,
  traveling,
  countdownNumber,
  countdownLabel,
  dateRange,
  dayCount,
  facts,
  children,
}: {
  tripId: string;
  title: string;
  traveling: boolean;
  countdownNumber: string;
  countdownLabel: string;
  dateRange: string;
  dayCount: number;
  facts: string[];
  children?: ReactNode;
}) {
  return (
    <div className="animate-fade-up [animation-fill-mode:forwards]">
      <div className="rounded-card-lg bg-brand-600 p-4 text-white">
        <p className="text-xs text-white/85">{traveling ? "旅行中" : "下一趟"}</p>
        <h2 className="mt-0.5 truncate text-[22px] font-black leading-snug">{title}</h2>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-3xl font-black tabular-nums">{countdownNumber}</span>
          <span className="text-sm text-white/90">
            {countdownLabel} · {dateRange} · {dayCount} 天
          </span>
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            href={`/trips/${tripId}`}
            className="inline-flex min-h-10 items-center rounded-lg bg-white px-3.5 text-sm font-bold text-brand-700 transition active:scale-[0.97]"
          >
            繼續規劃
          </Link>
          <Link
            href={`/trips/${tripId}?mode=doctor`}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-white/15 px-3.5 text-sm font-medium text-white transition hover:bg-white/25 active:scale-[0.97]"
          >
            <Stethoscope className="h-4 w-4" />
            健檢
          </Link>
        </div>
      </div>

      <div className="mt-2.5 flex flex-col gap-2">
        {facts.length > 0 ? (
          facts.map((fact) => (
            <p
              key={fact}
              className="flex items-start gap-2 rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-600"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {fact}
            </p>
          ))
        ) : (
          <p className="flex items-center gap-1.5 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            行程都排好了
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
