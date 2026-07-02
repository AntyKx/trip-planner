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

// Straight-line distance below which two stops are unambiguously "next
// door" (e.g. two attractions sharing the same complex). We trust this over
// whatever Directions returns, because WALKING/TRANSIT queries can flake or
// return an oddly long detour when the pedestrian graph doesn't have a
// direct path indexed between two very close points.
const OBVIOUS_WALK_KM = 1.0;
const ASSUMED_WALK_KMH = 4.5;

const EARTH_RADIUS_KM = 6371;

function haversineKm(
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function estimateWalk(straightLineKm: number): ComputedLeg {
  // Real walking paths are never a straight line, pad by ~30%.
  const distanceKm = Math.round(straightLineKm * 1.3 * 10) / 10;
  const durationMin = Math.max(1, Math.round((distanceKm / ASSUMED_WALK_KMH) * 60));
  return { mode: "WALK", durationMin, distanceKm };
}

async function fetchLeg(
  directionsService: google.maps.DirectionsService,
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  mode: TravelModeValue,
  region?: string
): Promise<ComputedLeg | null> {
  try {
    const result = await directionsService.route({
      origin,
      destination,
      travelMode: GOOGLE_TRAVEL_MODE[mode],
      region,
      ...(mode === "TRANSIT"
        ? { transitOptions: { departureTime: new Date() } }
        : {}),
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
// obviously-close stops always stay on foot, longer ones compare transit vs.
// driving and take whichever is faster. Falls back to whatever succeeded if
// the others fail, and to a straight-line walk estimate as a last resort so
// a leg is never left blank just because Directions had a bad response.
export async function computeBestLeg(
  directionsService: google.maps.DirectionsService,
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  region?: string
): Promise<ComputedLeg | null> {
  const straightLineKm = haversineKm(origin, destination);

  if (straightLineKm <= OBVIOUS_WALK_KM) {
    const walk = await fetchLeg(directionsService, origin, destination, "WALK", region);
    return walk ?? estimateWalk(straightLineKm);
  }

  const walk = await fetchLeg(directionsService, origin, destination, "WALK", region);
  if (walk && walk.durationMin <= WALK_GOOD_ENOUGH_MIN) return walk;

  const [transit, drive] = await Promise.all([
    fetchLeg(directionsService, origin, destination, "TRANSIT", region),
    fetchLeg(directionsService, origin, destination, "DRIVE", region),
  ]);

  const candidates = [transit, drive].filter(
    (c): c is ComputedLeg => c != null
  );
  if (candidates.length > 0) {
    return candidates.reduce((best, c) =>
      c.durationMin < best.durationMin ? c : best
    );
  }
  return walk ?? estimateWalk(straightLineKm);
}
