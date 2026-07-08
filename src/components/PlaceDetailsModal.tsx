"use client";

import { useState, useEffect, type ReactNode } from "react";
import { X, Star, MapPin, Phone, Globe, Clock, ExternalLink } from "lucide-react";
import { getPlaceDetails, type PlaceDetails } from "@/lib/places";
import ModalOverlay from "./ModalOverlay";
import PlaceInsightSection from "./PlaceInsightSection";

type Fallback = {
  name: string;
  address: string | null;
  rating: number | null;
  photoUrl: string | null;
};

export default function PlaceDetailsTrigger({
  provider,
  externalId,
  fallback,
  footer,
  tripId,
  dayId,
  children,
}: {
  provider: string;
  externalId: string;
  fallback: Fallback;
  footer?: ReactNode;
  // Needed so the AI fit-analysis section can judge this place against
  // whatever's already planned for that specific day (see
  // src/app/explore/aiActions.ts's getPlaceInsight) — not optional, every
  // caller already knows which trip/day it's showing this place in
  // context of.
  tripId: string;
  dayId: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="block w-full min-w-0 text-left"
      >
        {children}
      </button>

      {isOpen && (
        <PlaceDetailsModal
          provider={provider}
          externalId={externalId}
          fallback={fallback}
          footer={footer}
          tripId={tripId}
          dayId={dayId}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

function PlaceDetailsModal({
  provider,
  externalId,
  fallback,
  footer,
  tripId,
  dayId,
  onClose,
}: {
  provider: string;
  externalId: string;
  fallback: Fallback;
  footer?: ReactNode;
  tripId: string;
  dayId: string;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(provider === "google");

  useEffect(() => {
    if (provider !== "google") return;
    let cancelled = false;

    getPlaceDetails(externalId).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setDetails(res.details);
      } else {
        setError(res.error);
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [provider, externalId]);

  const photoUrl = details?.photoUrl ?? fallback.photoUrl ?? undefined;

  const displayName = details?.name || fallback.name;

  return (
    <ModalOverlay
      onClose={onClose}
      titleId="place-details-modal-title"
      panelClassName="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden"
    >
      <div className="overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="place-details-modal-title" className="text-lg font-bold text-ink-900">
            {displayName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-ink-400 hover:text-ink-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={displayName}
            className="mt-3 h-40 w-full rounded-xl object-cover"
          />
        )}

        {isLoading && (
          <p className="mt-4 text-sm text-ink-500">載入中…</p>
        )}

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

        {provider !== "google" && (
          <p className="mt-4 text-sm text-ink-500">
            這筆資料不是來自 Google，暫時沒有電話、營業時間、評論等詳細資訊。
          </p>
        )}

        <div className="mt-4 space-y-3 text-sm">
          {(details?.rating ?? fallback.rating) != null && (
            <p className="flex items-center gap-1.5 text-amber-500">
              <Star className="h-4 w-4 fill-amber-500" />
              {(details?.rating ?? fallback.rating)!.toFixed(1)}
              {details?.userRatingCount != null && (
                <span className="text-ink-500">
                  （{details.userRatingCount} 則評論）
                </span>
              )}
            </p>
          )}

          {(details?.address ?? fallback.address) && (
            <p className="flex items-start gap-2 text-ink-700">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              {details?.address ?? fallback.address}
            </p>
          )}

          {details?.phoneNumber && (
            <a
              href={`tel:${details.phoneNumber}`}
              className="flex items-center gap-2 text-ink-700 hover:text-brand-600"
            >
              <Phone className="h-4 w-4 text-ink-400" />
              {details.phoneNumber}
            </a>
          )}

          {details?.websiteUri && (
            <a
              href={details.websiteUri}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-brand-600 hover:underline"
            >
              <Globe className="h-4 w-4" />
              前往官網
            </a>
          )}

          {details?.openNow != null && (
            <p
              className={`flex items-center gap-2 ${
                details.openNow ? "text-emerald-600" : "text-red-500"
              }`}
            >
              <Clock className="h-4 w-4" />
              {details.openNow ? "營業中" : "已打烊"}
            </p>
          )}

          {details?.weekdayDescriptions && details.weekdayDescriptions.length > 0 && (
            <details className="text-ink-700">
              <summary className="cursor-pointer text-ink-700">
                查看完整營業時間
              </summary>
              <ul className="mt-1 space-y-0.5 pl-1">
                {details.weekdayDescriptions.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </details>
          )}

          {/* tripId/dayId can legitimately be empty here — Explore still
              lets you search and open this modal before any trip exists.
              Rendering the AI button then would be a trap: the action's
              requireTripEditor("") finds no trip and redirect()s the user
              to the home page mid-flow. */}
          {details && details.reviews.length > 0 && tripId && dayId && (
            <PlaceInsightSection
              provider={provider}
              externalId={externalId}
              placeName={displayName}
              reviews={details.reviews.map((r) => ({ rating: r.rating, text: r.text }))}
              tripId={tripId}
              dayId={dayId}
            />
          )}

          {details && details.reviews.length > 0 && (
            <div>
              <p className="font-medium text-ink-700">評論</p>
              <div className="mt-2 space-y-3">
                {details.reviews.map((r, i) => (
                  <div key={i} className="rounded-lg bg-paper-alt p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink-700">
                        {r.authorName}
                      </span>
                      <span className="shrink-0 text-xs text-ink-400">
                        {r.relativeTime}
                      </span>
                    </div>
                    {r.rating != null && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                        <Star className="h-3 w-3 fill-amber-500" />
                        {r.rating}
                      </p>
                    )}
                    {r.text && (
                      <p className="mt-1 line-clamp-4 text-ink-700">{r.text}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {details?.googleMapsUri && (
            <a
              href={details.googleMapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-line py-2 text-brand-600 hover:bg-paper-alt"
            >
              <ExternalLink className="h-4 w-4" />
              在 Google Maps 開啟
            </a>
          )}
        </div>
      </div>

      {footer && (
        <div className="shrink-0 border-t border-line p-3">{footer}</div>
      )}
    </ModalOverlay>
  );
}
