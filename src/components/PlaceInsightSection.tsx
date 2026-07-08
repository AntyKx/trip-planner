"use client";

import { useState } from "react";
import { Sparkles, TriangleAlert, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { getPlaceInsight, type ReviewInput, type PlaceInsightResult } from "@/app/explore/aiActions";
import { getPlaceDetails } from "@/lib/places";
import { useToast } from "./Toast";

type LoadedInsight = Extract<PlaceInsightResult, { ok: true }>;

function fitScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-700";
  if (score >= 40) return "text-amber-700";
  return "text-red-600";
}

// Shared by ExploreClient's search/favorites cards and PlaceDetailsModal —
// same "✨ AI 看看適不適合" button + gold-toned result card either way, so
// this only needs to be built (and gotten right) once.
export default function PlaceInsightSection({
  provider,
  externalId,
  placeName,
  // Omitted on the Explore card (reviews aren't fetched for every result
  // in a list — too expensive) — this then fetches place details itself,
  // but only when the button is actually clicked, same lazy-fetch
  // principle ExploreClient's handleAdd already uses for opening hours.
  // PlaceDetailsModal already has reviews loaded, so it passes them
  // directly and this never re-fetches.
  reviews,
  tripId,
  dayId,
  // Lets a caller (e.g. ExploreClient's result-card action row) place the
  // not-yet-analyzed trigger button inline next to other buttons instead
  // of always on its own line — the expanded result card ignores this in
  // practice since its own content is wide enough to fill a flex row on
  // its own regardless.
  className,
}: {
  provider: string;
  externalId: string;
  placeName: string;
  reviews?: ReviewInput[];
  tripId: string;
  dayId: string;
  className?: string;
}) {
  const toast = useToast();
  const [insight, setInsight] = useState<LoadedInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Only known to have zero reviews once details are actually loaded —
  // undefined (not yet fetched) still shows the button.
  if (reviews && reviews.length === 0) return null;

  async function handleAnalyze(forceRefresh = false) {
    setIsLoading(true);
    setError(null);

    let usableReviews = reviews;
    if (!usableReviews) {
      const details = await getPlaceDetails(externalId);
      if (!details.ok) {
        setIsLoading(false);
        setError("無法取得這個地點的評論");
        return;
      }
      usableReviews = details.details.reviews.map((r) => ({ rating: r.rating, text: r.text }));
      if (usableReviews.length === 0) {
        setIsLoading(false);
        setError("這個地點目前沒有足夠的評論可以分析");
        return;
      }
    }

    const res = await getPlaceInsight(
      provider,
      externalId,
      placeName,
      usableReviews,
      tripId,
      dayId,
      forceRefresh
    );
    setIsLoading(false);
    if (res.ok) {
      setInsight(res);
      toast.success(forceRefresh ? "已重新分析" : "AI 分析完成");
    } else {
      setError(res.error);
    }
  }

  if (!insight) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => handleAnalyze()}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-accent-100 bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-700 hover:bg-accent-100 disabled:opacity-50"
        >
          <Sparkles className={`h-3.5 w-3.5 ${isLoading ? "animate-pulse" : ""}`} />
          {isLoading ? "AI 分析中…" : "✨ AI 看看適不適合"}
        </button>
        {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`w-full rounded-lg border border-accent-100 bg-accent-50 p-3 text-sm ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-700">
          <Sparkles className="h-3.5 w-3.5" />
          AI 適合度分析
        </p>
        <span className={`text-sm font-bold ${fitScoreColor(insight.fitScore)}`}>
          {insight.fitScore}/100
        </span>
      </div>

      <p
        className={`mt-1.5 whitespace-pre-wrap text-ink-700 ${
          expanded ? "" : "line-clamp-2"
        }`}
      >
        {insight.summary}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 flex items-center gap-1 text-xs text-accent-700 hover:underline"
      >
        {expanded ? (
          <>
            收合 <ChevronUp className="h-3 w-3" />
          </>
        ) : (
          <>
            展開 <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>

      <p className="mt-2 text-xs text-ink-500">建議停留：{insight.suggestedDuration}</p>
      {insight.caution && (
        <p className="mt-1 flex items-start gap-1 text-xs text-amber-700">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          {insight.caution}
        </p>
      )}

      {/* The cached result never expires on its own — if the day's
          itinerary changed since this was generated (more stops added,
          reordered, ...), this is the only way to get a fresh read. */}
      <button
        type="button"
        onClick={() => handleAnalyze(true)}
        disabled={isLoading}
        className="mt-2 flex items-center gap-1 text-xs text-accent-700 hover:underline disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
        {isLoading ? "重新分析中…" : "重新分析"}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
