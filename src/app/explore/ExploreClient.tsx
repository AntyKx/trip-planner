"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { MapPin, Search, Check, Star, TriangleAlert, Heart } from "lucide-react";
import { searchPlaces, getPlaceDetails, type PlaceResult } from "@/lib/places";
import { addPlaceToDay } from "@/app/trips/actions";
import { addFavorite, removeFavorite } from "@/app/explore/actions";
import PlaceDetailsTrigger from "@/components/PlaceDetailsModal";
import { TYPE_LABEL } from "@/lib/labels";
import { isClosedAllDay, weekdayLabel, type OpeningPeriod } from "@/lib/businessHours";

export type TripOption = {
  id: string;
  title: string;
  days: { id: string; dayIndex: number; date: string }[];
};

export default function ExploreClient({
  trips,
  initialTripId,
  initialDayId,
  initialFavorites,
}: {
  trips: TripOption[];
  initialTripId?: string;
  initialDayId?: string;
  initialFavorites: PlaceResult[];
}) {
  const defaultTripId = initialTripId ?? trips[0]?.id ?? "";
  const defaultTrip = trips.find((t) => t.id === defaultTripId);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<"JP" | "TW">("JP");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();

  const [mode, setMode] = useState<"search" | "favorites">("search");
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
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [isAdding, startAdding] = useTransition();
  // "This day might be closed" warning per place, shown on the search
  // result card right after adding — not shown *before* adding since we
  // don't want to block the add flow on it, just flag it.
  const [closedWarnings, setClosedWarnings] = useState<Record<string, string>>({});

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchError(null);
    startSearch(async () => {
      const res = await searchPlaces(query, country);
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
      if (targetDay) {
        const details = await getPlaceDetails(place.externalId);
        if (details.ok) {
          openHoursJson = details.details.openHoursJson;
          if (openHoursJson) {
            const periods: OpeningPeriod[] = JSON.parse(openHoursJson);
            const date = new Date(`${targetDay.date}T00:00:00`);
            if (isClosedAllDay(periods, date)) {
              setClosedWarnings((prev) => ({
                ...prev,
                [place.externalId]: `⚠️ 這天（${weekdayLabel(date)}）可能公休，請確認營業時間`,
              }));
            }
          }
        }
      }

      await addPlaceToDay(selectedTripId, selectedDayId, place.suggestedType, {
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
      setAddedIds((prev) => new Set(prev).add(place.externalId));
    });
  }

  function handleToggleFavorite(place: PlaceResult) {
    const isFavorited = favoritedIds.has(place.externalId);
    startTogglingFavorite(async () => {
      if (isFavorited) {
        await removeFavorite("google", place.externalId);
        setFavorites((prev) => prev.filter((f) => f.externalId !== place.externalId));
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
      }
    });
  }

  function renderAddActions(place: PlaceResult) {
    if (addedIds.has(place.externalId)) {
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-600">
          <Check className="h-3.5 w-3.5" />
          已加入
        </span>
      );
    }
    return (
      <>
        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
          {TYPE_LABEL[place.suggestedType]}
        </span>
        <button
          type="button"
          disabled={!selectedDayId || isAdding}
          onClick={() => handleAdd(place)}
          className="rounded-md border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
        >
          加入行程
        </button>
      </>
    );
  }

  function renderPlaceCard(place: PlaceResult) {
    const isFavorited = favoritedIds.has(place.externalId);
    return (
      <div
        key={place.externalId}
        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {place.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={place.photoUrl}
                alt={place.name}
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <MapPin className="h-5 w-5 text-slate-400" />
              </div>
            )}
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
                  {renderAddActions(place)}
                </div>
              }
            >
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold text-ink-900 hover:text-brand-700">
                  {place.name}
                </h3>
                {place.rating != null && (
                  <span className="flex shrink-0 items-center gap-1 text-sm text-amber-500">
                    <Star className="h-3.5 w-3.5 fill-amber-500" />
                    {place.rating}
                  </span>
                )}
              </div>
            </PlaceDetailsTrigger>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => handleToggleFavorite(place)}
              disabled={isTogglingFavorite}
              aria-label={isFavorited ? "取消收藏" : "加入收藏"}
              aria-pressed={isFavorited}
              className="flex min-h-11 min-w-11 items-center justify-center text-ink-500 hover:text-red-500 disabled:opacity-50"
            >
              <Heart
                className={`h-5 w-5 ${
                  isFavorited ? "fill-red-500 text-red-500" : ""
                }`}
              />
            </button>
            <div className="flex flex-col gap-1">{renderAddActions(place)}</div>
          </div>
        </div>
        {closedWarnings[place.externalId] && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {closedWarnings[place.externalId]}
          </p>
        )}
      </div>
    );
  }

  const listToShow = mode === "search" ? results : favorites;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex items-center gap-4 text-sm">
        {selectedTripId && (
          <Link
            href={`/trips/${selectedTripId}`}
            className="text-slate-700 hover:underline"
          >
            ← 回到行程
          </Link>
        )}
        <Link href="/" className="text-slate-700 hover:underline">
          回首頁
        </Link>
      </div>
      <h1 className="mt-2 text-2xl font-bold text-ink-900">探索景點 / 餐廳</h1>
      <p className="mt-1 text-sm text-slate-700">
        選好行程與日期後可直接加入。
      </p>

      {trips.length === 0 ? (
        <p className="mt-6 text-sm text-slate-700">
          尚無行程，請先
          <Link href="/trips/new" className="mx-1 text-brand-600 underline">
            建立行程
          </Link>
          再來加點。
        </p>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <span className="text-slate-700">加入到：</span>
          <select
            value={selectedTripId}
            onChange={(e) => {
              const tripId = e.target.value;
              setSelectedTripId(tripId);
              const t = trips.find((tr) => tr.id === tripId);
              setSelectedDayId(t?.days[0]?.id ?? "");
            }}
            className="rounded-md border border-slate-200 px-2 py-1 text-base"
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
            className="rounded-md border border-slate-200 px-2 py-1 text-base"
          >
            {selectedTrip?.days.map((d) => (
              <option key={d.id} value={d.id}>
                Day {d.dayIndex}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-6 inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
            mode === "search"
              ? "bg-brand-600 text-white"
              : "text-ink-700 hover:bg-slate-50"
          }`}
        >
          <Search className="h-4 w-4" />
          搜尋
        </button>
        <button
          type="button"
          onClick={() => setMode("favorites")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
            mode === "favorites"
              ? "bg-brand-600 text-white"
              : "text-ink-700 hover:bg-slate-50"
          }`}
        >
          <Heart className="h-4 w-4" />
          我的收藏{favorites.length > 0 && `（${favorites.length}）`}
        </button>
      </div>

      {mode === "search" && (
        <>
          <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value as "JP" | "TW")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-base"
            >
              <option value="JP">🇯🇵 日本</option>
              <option value="TW">🇹🇼 台灣</option>
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋景點、餐廳關鍵字，例如：淺草 拉麵"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-base"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              {isSearching ? "搜尋中..." : "搜尋"}
            </button>
          </form>

          {searchError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {searchError}
            </p>
          )}
        </>
      )}

      <div className="mt-6 space-y-3">
        {listToShow.map(renderPlaceCard)}

        {mode === "search" && results.length === 0 && !isSearching && !searchError && (
          <p className="text-sm text-slate-600">輸入關鍵字開始搜尋。</p>
        )}

        {mode === "favorites" && favorites.length === 0 && (
          <p className="text-sm text-slate-600">
            還沒有收藏的地點，搜尋時點 ♡ 就可以加入收藏。
          </p>
        )}
      </div>
    </main>
  );
}
