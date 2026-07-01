"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { MapPin, Search, Check } from "lucide-react";
import { searchPlaces, type PlaceResult } from "@/lib/places";
import { addPlaceToDay } from "@/app/trips/actions";

export type TripOption = {
  id: string;
  title: string;
  days: { id: string; dayIndex: number }[];
};

export default function ExploreClient({
  trips,
  initialTripId,
}: {
  trips: TripOption[];
  initialTripId?: string;
}) {
  const defaultTripId = initialTripId ?? trips[0]?.id ?? "";
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<"JP" | "TW">("JP");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();

  const [selectedTripId, setSelectedTripId] = useState(defaultTripId);
  const [selectedDayId, setSelectedDayId] = useState(
    trips.find((t) => t.id === defaultTripId)?.days[0]?.id ?? ""
  );
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [isAdding, startAdding] = useTransition();

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

  function handleAdd(place: PlaceResult, type: "PLACE" | "RESTAURANT" | "HOTEL") {
    if (!selectedDayId) return;
    startAdding(async () => {
      await addPlaceToDay(selectedTripId, selectedDayId, type, {
        name: place.name,
        category: place.category || type,
        country,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        rating: place.rating,
        priceLevel: place.priceLevel,
        photoUrl: place.photoUrl,
        provider: "google",
        externalId: place.externalId,
      });
      setAddedIds((prev) => new Set(prev).add(place.externalId));
    });
  }

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
      <h1 className="mt-2 text-2xl font-bold text-slate-900">探索景點 / 餐廳</h1>
      <p className="mt-1 text-sm text-slate-700">
        搜尋結果來自 Google Places API，選好行程與日期後可直接加入。
      </p>

      {trips.length === 0 ? (
        <p className="mt-6 text-sm text-slate-700">
          尚無行程，請先
          <Link href="/trips/new" className="mx-1 text-teal-600 underline">
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
            className="rounded-md border border-slate-200 px-2 py-1"
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
            className="rounded-md border border-slate-200 px-2 py-1"
          >
            {selectedTrip?.days.map((d) => (
              <option key={d.id} value={d.id}>
                Day {d.dayIndex}
              </option>
            ))}
          </select>
        </div>
      )}

      <form onSubmit={handleSearch} className="mt-6 flex flex-col gap-2 sm:flex-row">
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value as "JP" | "TW")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="JP">🇯🇵 日本</option>
          <option value="TW">🇹🇼 台灣</option>
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋景點、餐廳關鍵字，例如：淺草 拉麵"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
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

      <div className="mt-6 space-y-3">
        {results.map((place) => (
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
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900">{place.name}</h3>
                  <p className="mt-0.5 truncate text-sm text-slate-600">
                    {[place.category, place.address].filter(Boolean).join(" · ")}
                    {place.rating != null && (
                      <span className="text-amber-500"> · ★ {place.rating}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                {addedIds.has(place.externalId) ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <Check className="h-3.5 w-3.5" />
                    已加入
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={!selectedDayId || isAdding}
                      onClick={() => handleAdd(place, "RESTAURANT")}
                      className="rounded-md border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                    >
                      加為餐廳
                    </button>
                    <button
                      type="button"
                      disabled={!selectedDayId || isAdding}
                      onClick={() => handleAdd(place, "PLACE")}
                      className="rounded-md border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                    >
                      加為景點
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {results.length === 0 && !isSearching && !searchError && (
          <p className="text-sm text-slate-600">輸入關鍵字開始搜尋。</p>
        )}
      </div>
    </main>
  );
}
