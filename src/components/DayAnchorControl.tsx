"use client";

import { useState, type FormEvent } from "react";
import { MapPin, Search, X } from "lucide-react";
import { searchPlaces, type PlaceResult } from "@/lib/places";
import {
  setDayAnchor,
  clearDayAnchor,
  type AnchorItemResult,
} from "@/app/trips/actions";

// "本日起點" is a real timeline card (type HOTEL) so it gets a photo,
// editable time/cost, and a real computed leg to the next stop via the
// normal auto-fill effect — this control just creates/updates/removes
// that card and keeps optimizeStopOrder's fixed-first-stop pointer
// (TripDay.anchorItemId) in sync. See src/app/trips/actions.ts.
export type DaySummary = { id: string; dayIndex: number; date: string };

export default function DayAnchorControl({
  tripId,
  dayId,
  anchorName,
  defaultCountry,
  otherDays,
  onAnchorSet,
  onAnchorCleared,
}: {
  tripId: string;
  dayId: string;
  anchorName: string | null;
  defaultCountry: string;
  otherDays: DaySummary[];
  onAnchorSet: (item: AnchorItemResult) => void;
  onAnchorCleared: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Same JP/TW-preset-or-free-text pattern as the explore search (see
  // src/lib/places.ts) — JP/TW get Google's precise rectangle restriction,
  // anything else is appended as free text and left to Google's own text
  // understanding. Seeded from whichever country this day's other items
  // are already in, so re-opening this for an existing US/etc. day doesn't
  // reset back to Japan.
  const isPresetCountry = defaultCountry === "TW" || defaultCountry === "JP";
  const [region, setRegion] = useState<"JP" | "TW" | "OTHER">(
    isPresetCountry ? (defaultCountry as "JP" | "TW") : "OTHER"
  );
  const [customRegion, setCustomRegion] = useState(isPresetCountry ? "" : defaultCountry);
  const effectiveRegion = region === "OTHER" ? customRegion : region;
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyToDayIds, setApplyToDayIds] = useState<Set<string>>(new Set());

  function toggleApplyDay(id: string) {
    setApplyToDayIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setIsSearching(true);
    searchPlaces(query, effectiveRegion).then((res) => {
      setIsSearching(false);
      if (res.ok) {
        setResults(res.results);
      } else {
        setError(res.error);
        setResults([]);
      }
    });
  }

  async function handlePick(place: PlaceResult) {
    const confirmMessage = anchorName
      ? `確定要把本日起點改成「${place.name}」嗎？`
      : `確定要把「${place.name}」設為本日起點嗎？`;
    if (!confirm(confirmMessage)) return;

    setIsSaving(true);
    setError(null);
    try {
      const results = await setDayAnchor(
        tripId,
        dayId,
        {
          name: place.name,
          category: place.category || "hotel",
          // From Google's own address data for this result (see
          // countryFromAddressComponents in src/lib/places.ts), not the
          // region selector above — the selector's value is just a search
          // hint and may not match where the picked place actually is
          // (e.g. searching "OTHER" broadly, or a border-area result).
          country: place.country,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          rating: place.rating,
          priceLevel: place.priceLevel,
          photoUrl: place.photoUrl,
          provider: "google",
          externalId: place.externalId,
        },
        Array.from(applyToDayIds)
      );
      const mine = results[dayId];
      if (mine) onAnchorSet(mine);
      setIsOpen(false);
      setResults([]);
      setQuery("");
      setApplyToDayIds(new Set());
    } catch {
      setError("設定起點失敗，請再試一次");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClear() {
    setIsSaving(true);
    try {
      await clearDayAnchor(tripId, dayId);
      onAnchorCleared();
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-ink-500">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        {anchorName ? (
          <>
            <span>
              本日起點：<span className="font-medium text-ink-700">{anchorName}</span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="text-brand-600 hover:underline"
            >
              變更
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={isSaving}
              className="text-ink-500 hover:underline disabled:opacity-50"
            >
              清除
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="text-brand-600 hover:underline"
          >
            設定本日起點（例如飯店）
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-paper-alt p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-ink-700">設定本日起點</span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="關閉"
          className="text-ink-500 hover:text-ink-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSearch} className="mt-2 flex flex-wrap gap-1.5">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value as "JP" | "TW" | "OTHER")}
          className="rounded-md border border-line bg-surface px-1.5 py-1.5 text-xs"
        >
          <option value="JP">日本</option>
          <option value="TW">台灣</option>
          <option value="OTHER">其他地區...</option>
        </select>
        {region === "OTHER" && (
          <input
            type="text"
            value={customRegion}
            onChange={(e) => setCustomRegion(e.target.value)}
            placeholder="國家/城市"
            className="w-20 min-w-0 rounded-md border border-line px-2 py-1.5 text-xs"
          />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋飯店/地點名稱"
          className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="flex shrink-0 items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1.5 text-white disabled:opacity-50"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      </form>

      {otherDays.length > 0 && (
        <div className="mt-2">
          <p className="text-ink-600">同步套用到其他天數（例如連住同一間飯店）：</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {otherDays.map((day) => (
              <label
                key={day.id}
                className={`flex items-center gap-1 rounded-full border px-2 py-1 ${
                  applyToDayIds.has(day.id)
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-line bg-surface text-ink-600"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={applyToDayIds.has(day.id)}
                  onChange={() => toggleApplyDay(day.id)}
                />
                Day {day.dayIndex}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-red-600">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {results.map((place) => (
            <li key={place.externalId}>
              <button
                type="button"
                onClick={() => handlePick(place)}
                disabled={isSaving}
                className="flex w-full items-start gap-2 rounded-md border border-line bg-surface p-2 text-left hover:border-brand-300 disabled:opacity-50"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
                <span>
                  <span className="block font-medium text-ink-900">{place.name}</span>
                  <span className="block text-ink-500">{place.address}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
