import Link from "next/link";
import { BookOpen, Footprints, Heart, Luggage, Map as MapIcon, Plus } from "lucide-react";
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
          <Link
            href={`/trips/${trip.id}/journal`}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3.5 text-sm font-medium text-ink-900 transition active:scale-[0.97]"
          >
            <BookOpen className="h-4 w-4" />
            翻翻旅遊書
          </Link>
          <Link
            href={`/trips/${trip.id}`}
            className="inline-flex min-h-10 items-center rounded-xl bg-white/20 px-3.5 text-sm font-medium text-white backdrop-blur transition active:scale-[0.97]"
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
      <div className="grid grid-cols-3 rounded-card-lg border border-line bg-surface py-4">
        {stats.map((s) => (
          <div key={s.label} className="border-r border-line text-center last:border-r-0">
            <p className="text-2xl font-bold text-ink-900 tabular-nums">{s.value}</p>
            <p className="text-xs text-ink-500">{s.label}</p>
          </div>
        ))}
      </div>
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
      <div className="grid gap-3 rounded-card-lg border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
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
