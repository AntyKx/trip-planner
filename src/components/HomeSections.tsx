import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Footprints,
  Globe,
  Heart,
  Images,
  ListChecks,
  Luggage,
  Map as MapIcon,
  Plus,
} from "lucide-react";
import ImgWithFallback from "./ImgWithFallback";
import SectionHeader from "./SectionHeader";
import { appButtonClassName } from "./AppButton";
import { formatRelativeTime } from "@/lib/labels";

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
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent-500 to-brand-700">
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
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3.5 text-sm font-medium text-ink-900 transition active:scale-[0.97]"
            >
              <BookOpen className="h-4 w-4" />
              翻翻旅遊書
            </Link>
          )}
          <Link
            href={`/trips/${trip.id}`}
            className={`inline-flex min-h-10 items-center rounded-xl px-3.5 text-sm font-medium transition active:scale-[0.97] ${
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
                className={`h-11 w-11 rounded-xl border-2 border-white object-cover shadow-sm ${i > 0 ? "-ml-2.5" : ""}`}
                fallback={
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 border-white bg-brand-50 shadow-sm ${i > 0 ? "-ml-2.5" : ""}`}
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

// A fixed, hand-picked list — labelled 精選清單 on screen so it never reads
// as a personalised recommendation. region/customRegion match the explore
// page's own region picker (JP/TW get Google's hard bounds; anything else
// is appended to the query as free text).
const DESTINATIONS: { city: string; country: string; region: "JP" | "TW" | "OTHER" }[] = [
  { city: "東京", country: "日本", region: "JP" },
  { city: "京都", country: "日本", region: "JP" },
  { city: "大阪", country: "日本", region: "JP" },
  { city: "首爾", country: "韓國", region: "OTHER" },
  { city: "釜山", country: "韓國", region: "OTHER" },
  { city: "曼谷", country: "泰國", region: "OTHER" },
  { city: "台南", country: "台灣", region: "TW" },
  { city: "花蓮", country: "台灣", region: "TW" },
];

function destinationHref(d: (typeof DESTINATIONS)[number]) {
  const params = new URLSearchParams({ q: `${d.city} 景點`, region: d.region });
  if (d.region === "OTHER") params.set("area", d.country);
  return `/explore?${params.toString()}`;
}

export function InspirationChips() {
  return (
    <section className="mt-10">
      <SectionHeader
        title="目的地靈感"
        icon={MapIcon}
        className="mb-4"
        action={<span className="text-xs text-ink-400">精選清單</span>}
      />
      <div className="flex flex-wrap gap-2">
        {DESTINATIONS.map((d) => (
          <Link
            key={d.city}
            href={destinationHref(d)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm text-ink-900 transition hover:border-brand-200 hover:bg-brand-50"
          >
            {d.city}
            <span className="text-[11px] text-ink-400">{d.country}</span>
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
      className="absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink-700 shadow-sm backdrop-blur hover:bg-white"
    >
      <ListChecks className="h-4 w-4" />
    </Link>
  );

  if (variant === "row") {
    return (
      <div className="relative w-[132px] shrink-0 snap-start">
        <Link href={tileHref} className="group block">
          <div className="relative h-[150px] overflow-hidden rounded-2xl bg-paper-alt">
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
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:shadow-soft"
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
          className="flex h-[150px] w-[110px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-line-strong bg-surface text-sm font-medium text-brand-700"
        >
          <ListChecks className="h-5 w-5" />
          查看全部
          <span className="text-xs font-normal text-ink-500">{total} 趟</span>
        </Link>
      </div>
    </section>
  );
}
