"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { MapPin, Search, Check, Star, TriangleAlert, Heart } from "lucide-react";
import { searchPlaces, getPlaceDetails, type PlaceResult } from "@/lib/places";
import { addPlaceToDay } from "@/app/trips/actions";
import { addFavorite, removeFavorite } from "@/app/explore/actions";
import PlaceDetailsTrigger from "@/components/PlaceDetailsModal";
import PlaceInsightSection from "@/components/PlaceInsightSection";
import AppCard from "@/components/AppCard";
import AppBadge from "@/components/AppBadge";
import AppButton from "@/components/AppButton";
import IconButton from "@/components/IconButton";
import EmptyState from "@/components/EmptyState";
import ImgWithFallback from "@/components/ImgWithFallback";
import {
  NoSearchResultsIllustration,
  NoFavoritesIllustration,
} from "@/components/EmptyStateIllustrations";
import { SearchResultSkeleton } from "@/components/LoadingSkeleton";
import { useToast } from "@/components/Toast";
import { TYPE_LABEL } from "@/lib/labels";
import { isClosedAllDay, weekdayLabel, type OpeningPeriod } from "@/lib/businessHours";

export type TripOption = {
  id: string;
  title: string;
  days: { id: string; dayIndex: number; date: string; itemCount: number }[];
};

const WEEKDAY_LABEL = ["日", "一", "二", "三", "四", "五", "六"];

// date is a "YYYY-MM-DD" string (see ExplorePage) — parsed and read back via
// UTC getters so the displayed day/weekday can't drift a day off depending
// on the viewer's local timezone offset.
function formatDayOption(dayIndex: number, date: string, itemCount: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  // Count kept terse（「・3 個」）— the select renders at a forced 16px
  // (see the globals.css iOS-zoom rule), so long option labels overflow
  // the narrow control.
  return `Day ${dayIndex} · ${mm}/${dd}（${WEEKDAY_LABEL[d.getUTCDay()]}）・${itemCount} 個`;
}

export default function ExploreClient({
  trips,
  initialTripId,
  initialDayId,
  initialFavorites,
  initialView,
}: {
  trips: TripOption[];
  initialTripId?: string;
  initialDayId?: string;
  initialFavorites: PlaceResult[];
  // Deep-link entry (home page's 我的收藏 quick entry uses
  // /explore?view=favorites) — the tab itself is client state.
  initialView?: "search" | "favorites";
}) {
  const defaultTripId = initialTripId ?? trips[0]?.id ?? "";
  const defaultTrip = trips.find((t) => t.id === defaultTripId);
  const toast = useToast();
  const [query, setQuery] = useState("");
  // "JP"/"TW" get Google's precise geographic-rectangle restriction (see
  // COUNTRY_BOUNDS in src/lib/places.ts); "OTHER" means the user typed a
  // free-text region (customRegion) that just gets appended to the search
  // query instead — no hard filter, so it works for any country/city but
  // relies on Google's own text understanding for accuracy.
  const [region, setRegion] = useState<"JP" | "TW" | "OTHER">("JP");
  const [customRegion, setCustomRegion] = useState("");
  const effectiveRegion = region === "OTHER" ? customRegion : region;
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  // Distinguishes "haven't searched yet" from "searched, found nothing" —
  // both used to show the same generic prompt.
  const [hasSearched, setHasSearched] = useState(false);

  const [mode, setMode] = useState<"search" | "favorites">(
    initialView ?? "search"
  );
  const [favorites, setFavorites] = useState<PlaceResult[]>(initialFavorites);
  const [isTogglingFavorite, startTogglingFavorite] = useTransition();
  const favoritedIds = new Set(favorites.map((f) => f.externalId));

  const [selectedTripId, setSelectedTripId] = useState(defaultTripId);
  const [selectedDayId, setSelectedDayId] = useState(
    // Default to whichever day the user came from (e.g. clicked "搜尋景點"
    // from within that day's view), not always Day 1.
    (initialDayId && defaultTrip?.days.some((d) => d.id === initialDayId)
      ? initialDayId
      : defaultTrip?.days[0]?.id) ?? ""
  );
  // Keyed by "dayId:externalId", not just externalId — otherwise adding a
  // place to Day 1 made it show "已加入" (and any stale closed-day warning)
  // on every other day too, even where it was never actually added. The
  // same place can legitimately get added to several different days (e.g.
  // a hotel across a multi-night stay), so this has to track per-day state.
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  // Local +1s on top of the server-loaded per-day item counts, so the day
  // picker's「・N 個」updates immediately after each add without refetching.
  const [dayCountBump, setDayCountBump] = useState<Record<string, number>>({});
  const [isAdding, startAdding] = useTransition();
  // Bumped on every favorite toggle (add or remove) — used as the heart
  // icon's `key` so it remounts and replays the pop-in animation on each
  // click, without also playing it on the initial list render (where the
  // key would just be its unchanged default).
  const [favoritePulse, setFavoritePulse] = useState<Record<string, number>>({});
  // "This day might be closed" warning per place, shown on the search
  // result card right after adding — not shown *before* adding since we
  // don't want to block the add flow on it, just flag it.
  const [closedWarnings, setClosedWarnings] = useState<Record<string, string>>({});

  function dayPlaceKey(dayId: string, externalId: string) {
    return `${dayId}:${externalId}`;
  }

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchError(null);
    setHasSearched(true);
    startSearch(async () => {
      const res = await searchPlaces(query, effectiveRegion);
      if (res.ok) {
        setResults(res.results);
      } else {
        setSearchError(res.error);
        setResults([]);
      }
    });
  }

  function handleAdd(place: PlaceResult) {
    if (!selectedDayId) return;
    const targetDay = selectedTrip?.days.find((d) => d.id === selectedDayId);

    startAdding(async () => {
      // Fetching hours here (instead of bulk-fetching for every search
      // result) keeps the search list itself cheap — only the place
      // actually being added pays for the extra Places API call.
      let openHoursJson: string | undefined;
      let warning: string | undefined;
      if (targetDay) {
        const details = await getPlaceDetails(place.externalId);
        if (details.ok) {
          openHoursJson = details.details.openHoursJson;
          if (openHoursJson) {
            const periods: OpeningPeriod[] = JSON.parse(openHoursJson);
            const date = new Date(`${targetDay.date}T00:00:00`);
            if (isClosedAllDay(periods, date)) {
              warning = `⚠️ 這天（${weekdayLabel(date)}）可能公休，請確認營業時間`;
            }
          }
        }
      }
      // Always resolve (set or clear) this day+place's entry — otherwise a
      // closed-day warning from adding to a different, closed day would
      // keep showing even after successfully adding to an open one.
      setClosedWarnings((prev) => {
        const next = { ...prev };
        const key = dayPlaceKey(selectedDayId, place.externalId);
        if (warning) next[key] = warning;
        else delete next[key];
        return next;
      });

      const added = await addPlaceToDay(selectedTripId, selectedDayId, place.suggestedType, {
        name: place.name,
        category: place.category || place.suggestedType,
        country: place.country,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        rating: place.rating,
        priceLevel: place.priceLevel,
        photoUrl: place.photoUrl,
        provider: "google",
        externalId: place.externalId,
        openHours: openHoursJson,
        suggestedType: place.suggestedType,
      });
      setAddedIds((prev) => new Set(prev).add(dayPlaceKey(selectedDayId, place.externalId)));
      setDayCountBump((prev) => ({
        ...prev,
        [selectedDayId]: (prev[selectedDayId] ?? 0) + 1,
      }));
      // Handshake with TripDayBoard: on the next visit to this trip's page
      // it selects this day and plays a one-shot highlight on the new card,
      // so the user sees exactly where the place landed.
      try {
        sessionStorage.setItem(
          "trip-planner:last-added",
          JSON.stringify({
            tripId: selectedTripId,
            dayId: selectedDayId,
            itemId: added.itemId,
          })
        );
      } catch {
        // Storage unavailable (private mode quirks) — highlight is a
        // nice-to-have, never block the add itself.
      }
      // Day first — it's the part that must survive if a long place name
      // pushes the message to the toast's two-line clamp.
      toast.success(
        targetDay
          ? `已加入 Day ${targetDay.dayIndex}（${targetDay.date.slice(5).replace("-", "/")}）：${place.name}`
          : `已加入「${place.name}」`
      );
    });
  }

  function handleToggleFavorite(place: PlaceResult) {
    const isFavorited = favoritedIds.has(place.externalId);
    setFavoritePulse((prev) => ({
      ...prev,
      [place.externalId]: (prev[place.externalId] ?? 0) + 1,
    }));
    startTogglingFavorite(async () => {
      if (isFavorited) {
        await removeFavorite("google", place.externalId);
        setFavorites((prev) => prev.filter((f) => f.externalId !== place.externalId));
        toast.success("已取消收藏");
      } else {
        await addFavorite({
          name: place.name,
          category: place.category || place.suggestedType,
          country: place.country,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          rating: place.rating,
          priceLevel: place.priceLevel,
          photoUrl: place.photoUrl,
          provider: "google",
          externalId: place.externalId,
          suggestedType: place.suggestedType,
        });
        setFavorites((prev) => [place, ...prev]);
        toast.success("已加入收藏");
      }
    });
  }

  // Add/added-state action — the ONE place this renders, shared by the
  // card's own action row and the detail modal's footer, so a place never
  // shows two independent "加入" controls (or two type badges) at once.
  function renderAddControl(place: PlaceResult) {
    const isAdded = addedIds.has(dayPlaceKey(selectedDayId, place.externalId));
    if (isAdded) {
      return (
        <AppBadge variant="success" className="animate-pop-in">
          <Check className="h-3.5 w-3.5" />
          已加入
        </AppBadge>
      );
    }
    return (
      <AppButton
        size="sm"
        disabled={!selectedDayId || isAdding}
        onClick={() => handleAdd(place)}
      >
        加入
      </AppButton>
    );
  }

  function renderPlaceCard(place: PlaceResult) {
    const isFavorited = favoritedIds.has(place.externalId);
    const closedWarning = closedWarnings[dayPlaceKey(selectedDayId, place.externalId)];
    return (
      <AppCard key={place.externalId} variant="interactive" padding="sm">
        <div className="flex gap-3">
          <ImgWithFallback
            src={place.photoUrl}
            alt={place.name}
            className="h-18 w-18 shrink-0 rounded-lg object-cover"
            fallback={
              <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-lg bg-paper-alt">
                <MapPin className="h-5 w-5 text-ink-400" />
              </div>
            }
          />
          <div className="min-w-0 flex-1">
            {/* Trigger wraps name + address (not just name) — the whole
                info block is the "view details" affordance, so there's no
                need for a second, separately-styled "查看詳情" button
                competing with the real "加入" action below it. */}
            <PlaceDetailsTrigger
              provider="google"
              externalId={place.externalId}
              fallback={{
                name: place.name,
                address: place.address || null,
                rating: place.rating ?? null,
                photoUrl: place.photoUrl ?? null,
              }}
              footer={
                <div className="flex items-center justify-end gap-2">
                  {renderAddControl(place)}
                </div>
              }
              tripId={selectedTripId}
              dayId={selectedDayId}
            >
              <h3 className="line-clamp-2 font-semibold text-ink-900 hover:text-brand-700">
                {place.name}
              </h3>
              {place.address && (
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{place.address}</p>
              )}
            </PlaceDetailsTrigger>

            {/* Rating/type/price are secondary info — de-emphasized (ink
                tone, not bold color) next to the actual name/address. */}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {place.rating != null && (
                <span className="flex shrink-0 items-center gap-1 text-xs text-ink-500">
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  {place.rating}
                </span>
              )}
              <AppBadge variant="brand">{TYPE_LABEL[place.suggestedType]}</AppBadge>
              {place.priceLevel != null && place.priceLevel > 0 && (
                <span className="text-xs text-ink-500">{"$".repeat(place.priceLevel)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Outside the photo+text row on purpose — squeezed into the
            narrow column next to the photo, there isn't enough width for
            the AI trigger and favorite/add to actually stay side by side
            (they'd wrap under each other despite the row/justify-between
            styling, since flex-wrap only keeps things on one line when
            they fit). Spanning the full card width instead gives them
            enough room. */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {selectedTripId && selectedDayId ? (
            <PlaceInsightSection
              // Forces a remount (resetting its cached analysis) when
              // the target day changes — otherwise it'd keep showing a
              // fitScore/summary computed for whichever day it was last
              // analyzed against, mislabeled as if it were for the
              // newly-selected day.
              key={selectedDayId}
              provider="google"
              externalId={place.externalId}
              placeName={place.name}
              tripId={selectedTripId}
              dayId={selectedDayId}
              compact
            />
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <IconButton
              variant="ghost"
              onClick={() => handleToggleFavorite(place)}
              disabled={isTogglingFavorite}
              aria-label={isFavorited ? "取消收藏" : "加入收藏"}
              aria-pressed={isFavorited}
              icon={
                <Heart
                  key={favoritePulse[place.externalId] ?? 0}
                  className={`h-5 w-5 animate-pop-in ${isFavorited ? "fill-red-500 text-red-500" : ""}`}
                />
              }
            />
            {renderAddControl(place)}
          </div>
        </div>
        {closedWarning && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {closedWarning}
          </p>
        )}
      </AppCard>
    );
  }

  const listToShow = mode === "search" ? results : favorites;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-4 text-sm">
        {selectedTripId && (
          <Link
            href={`/trips/${selectedTripId}`}
            className="text-ink-700 hover:underline"
          >
            ← 回到行程
          </Link>
        )}
        <Link href="/" className="text-ink-700 hover:underline">
          回首頁
        </Link>
      </div>
      <h1 className="mt-2 text-2xl font-bold text-ink-900">探索景點 / 餐廳</h1>

      {trips.length === 0 ? (
        <p className="mt-6 text-sm text-ink-700">
          尚無行程，請先
          <Link href="/trips/new" className="mx-1 text-brand-600 underline">
            建立行程
          </Link>
          再來加點。
        </p>
      ) : (
        <div className="sticky top-0 z-[var(--z-dropdown)] -mx-4 mt-4 space-y-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          {mode === "search" && (
            <>
              {/* Region comes before the search box — it narrows/biases
                  what the search box's own results mean, so picking it
                  first (not after typing a query) matches the order
                  someone actually reasons through the search in. */}
              <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as "JP" | "TW" | "OTHER")}
                  className="rounded-lg border border-line px-3 py-2 text-base"
                >
                  <option value="JP">🇯🇵 日本</option>
                  <option value="TW">🇹🇼 台灣</option>
                  <option value="OTHER">🌐 其他地區...</option>
                </select>
                {region === "OTHER" && (
                  <input
                    value={customRegion}
                    onChange={(e) => setCustomRegion(e.target.value)}
                    placeholder="輸入國家或城市，例如：法國、首爾"
                    className="min-w-0 rounded-lg border border-line px-3 py-2 text-base sm:w-40"
                  />
                )}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜尋景點、餐廳關鍵字，例如：淺草 拉麵"
                  className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-base"
                />
                <AppButton type="submit" isLoading={isSearching} icon={<Search className="h-4 w-4" />}>
                  {isSearching ? "搜尋中..." : "搜尋"}
                </AppButton>
              </form>
              {region === "OTHER" && (
                <p className="text-xs text-ink-500">
                  非日本／台灣地區採關鍵字搜尋，範圍與精確度會依 Google 判斷，建議在關鍵字或地區中加上城市名。
                </p>
              )}
              {searchError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {searchError}
                </p>
              )}
            </>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-500">加入至：</span>
            <select
              value={selectedTripId}
              onChange={(e) => {
                const tripId = e.target.value;
                setSelectedTripId(tripId);
                const t = trips.find((tr) => tr.id === tripId);
                setSelectedDayId(t?.days[0]?.id ?? "");
              }}
              className="rounded-md border border-line px-2 py-1 text-base"
            >
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <select
              value={selectedDayId}
              onChange={(e) => setSelectedDayId(e.target.value)}
              className="rounded-md border border-line px-2 py-1 text-base"
            >
              {selectedTrip?.days.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDayOption(
                    d.dayIndex,
                    d.date,
                    d.itemCount + (dayCountBump[d.id] ?? 0)
                  )}
                </option>
              ))}
            </select>
          </div>

          <div role="tablist" aria-label="搜尋或收藏" className="inline-flex rounded-lg border border-line bg-paper-alt p-1 text-sm">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "search"}
              onClick={() => setMode("search")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
                mode === "search"
                  ? "bg-surface text-brand-700 shadow-raised"
                  : "text-ink-700 hover:text-ink-900"
              }`}
            >
              <Search className="h-4 w-4" />
              搜尋
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "favorites"}
              onClick={() => setMode("favorites")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
                mode === "favorites"
                  ? "bg-surface text-brand-700 shadow-raised"
                  : "text-ink-700 hover:text-ink-900"
              }`}
            >
              <Heart className="h-4 w-4" />
              我的收藏{favorites.length > 0 && `（${favorites.length}）`}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {mode === "search" && isSearching ? (
          <>
            <SearchResultSkeleton />
            <SearchResultSkeleton />
            <SearchResultSkeleton />
          </>
        ) : (
          listToShow.map(renderPlaceCard)
        )}

        {mode === "search" && !isSearching && results.length === 0 && !searchError && (
          <EmptyState
            illustration={<NoSearchResultsIllustration />}
            title={hasSearched ? "找不到符合的景點" : "輸入關鍵字開始搜尋"}
            description={hasSearched ? "試試其他關鍵字，或換一個地區看看。" : undefined}
          />
        )}

        {mode === "favorites" && favorites.length === 0 && (
          <EmptyState
            illustration={<NoFavoritesIllustration />}
            title="還沒有收藏的地點"
            description="搜尋時點 ♡ 就可以加入收藏。"
          />
        )}
      </div>
    </main>
  );
}
