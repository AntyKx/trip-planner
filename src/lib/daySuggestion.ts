import { haversineKm } from "./routeMode";

export type DayForSuggestion = {
  id: string;
  places: google.maps.LatLngLiteral[];
};

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
  return bestDayId;
}
