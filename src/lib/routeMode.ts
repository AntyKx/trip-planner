import type { TravelModeValue } from "@/app/trips/actions";

export const GOOGLE_TRAVEL_MODE: Record<TravelModeValue, google.maps.TravelMode> = {
  WALK: "WALKING" as google.maps.TravelMode,
  TRANSIT: "TRANSIT" as google.maps.TravelMode,
  DRIVE: "DRIVING" as google.maps.TravelMode,
  BIKE: "BICYCLING" as google.maps.TravelMode,
};

export type ComputedLeg = {
  mode: TravelModeValue;
  durationMin: number;
  distanceKm: number;
};

// Below this walking time, walking beats waiting for + riding transit or
// finding parking, so we don't bother comparing other modes.
const WALK_GOOD_ENOUGH_MIN = 20;

async function fetchLeg(
  directionsService: google.maps.DirectionsService,
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  mode: TravelModeValue
): Promise<ComputedLeg | null> {
  try {
    const result = await directionsService.route({
      origin,
      destination,
      travelMode: GOOGLE_TRAVEL_MODE[mode],
    });
    const leg = result.routes[0]?.legs?.[0];
    if (!leg?.duration || !leg?.distance) return null;
    return {
      mode,
      durationMin: Math.round(leg.duration.value / 60),
      distanceKm: Math.round((leg.distance.value / 1000) * 10) / 10,
    };
  } catch {
    return null;
  }
}

// Mirrors how trip-planning apps like Tabikoto pick a leg's transport mode:
// short hops stay on foot, longer ones compare transit vs. driving and take
// whichever is faster. Falls back to whatever succeeded if the others fail.
export async function computeBestLeg(
  directionsService: google.maps.DirectionsService,
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral
): Promise<ComputedLeg | null> {
  const walk = await fetchLeg(directionsService, origin, destination, "WALK");
  if (walk && walk.durationMin <= WALK_GOOD_ENOUGH_MIN) return walk;

  const [transit, drive] = await Promise.all([
    fetchLeg(directionsService, origin, destination, "TRANSIT"),
    fetchLeg(directionsService, origin, destination, "DRIVE"),
  ]);

  const candidates = [transit, drive].filter(
    (c): c is ComputedLeg => c != null
  );
  if (candidates.length > 0) {
    return candidates.reduce((best, c) =>
      c.durationMin < best.durationMin ? c : best
    );
  }
  return walk;
}
