import { haversineKm } from "./routeMode";

export type DayForSuggestion = {
  id: string;
  places: google.maps.LatLngLiteral[];
};

// Beyond this, "nearest day" stops meaning "reasonable to visit the same
// day" — it just means "least far of several very far options". Real report:
// a trip with only one day populated (a Miyajima/Itsukushima torii gate)
// still got suggested for a newly searched Asakusa, Tokyo place, ~800km
// away, purely because it was technically the closest of the (only) day
// with any data. ~100km covers city-plus-day-trip range (e.g. Tokyo↔Hakone)
// without reaching into cross-region distances that are never a same-day
// sightseeing pairing — a same-day flight leg between two distant airports
// is unaffected, since that comparison is against the *new place* being
// searched, not between a day's own existing items.
const MAX_SUGGESTION_DISTANCE_KM = 100;

// Nearest-single-item distance, not centroid — "this is close to one thing
// you already have that day" is the intuitive signal (e.g. a day anchored
// on one city cluster plus one outlier), whereas a centroid would get
// dragged off by that same outlier and could recommend against the day the
// place is actually walkable from.
export function suggestDayForPlace(
  place: google.maps.LatLngLiteral,
  days: DayForSuggestion[]
): string | null {
  let bestDayId: string | null = null;
  let bestDistanceKm = Infinity;
  for (const day of days) {
    for (const p of day.places) {
      const distanceKm = haversineKm(place, p);
      if (distanceKm < bestDistanceKm) {
        bestDistanceKm = distanceKm;
        bestDayId = day.id;
      }
    }
  }
  return bestDistanceKm <= MAX_SUGGESTION_DISTANCE_KM ? bestDayId : null;
}
