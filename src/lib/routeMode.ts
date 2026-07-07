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

// Google's Directions/Routes API transit data explicitly excludes these
// countries' transit partners (per Google's own Maps Platform FAQ), so a
// TRANSIT query there always fails — no point calling it, and the manual
// mode picker should say so instead of offering a mode that can't work.
// https://developers.google.com/maps/faq
const GOOGLE_TRANSIT_UNSUPPORTED_COUNTRIES = new Set(["JP", "IN"]);

export function isGoogleTransitSupported(country: string | undefined): boolean {
  return !GOOGLE_TRANSIT_UNSUPPORTED_COUNTRIES.has((country ?? "").toUpperCase());
}

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
      language: "zh-TW",
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

  // Fetch every candidate mode up front instead of walk-then-wait-then-
  // transit/drive: we used to await walk alone before even starting the
  // transit/drive calls, so a non-obvious leg paid for two round trips back
  // to back. Querying all three at once costs a couple of extra Directions
  // calls when walking turns out to be good enough, but that's a fair trade
  // for cutting each leg's latency roughly in half.
  const transitSupported = isGoogleTransitSupported(region);
  const [walk, transit, drive] = await Promise.all([
    fetchLeg(directionsService, origin, destination, "WALK", region),
    transitSupported
      ? fetchLeg(directionsService, origin, destination, "TRANSIT", region)
      : Promise.resolve(null),
    fetchLeg(directionsService, origin, destination, "DRIVE", region),
  ]);
  if (walk && walk.durationMin <= WALK_GOOD_ENOUGH_MIN) return walk;

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

// Local search that keeps reversing whichever segment shortens the total
// path distance, until no more improvement is found. path[0] always stays
// fixed (the trip's real first stop, or a virtual anchor not included in
// the final result — see optimizeStopOrder). The last element only stays
// fixed when `fixLast` is true; otherwise it's free to end up anywhere,
// which is what lets a geographic outlier land at the edge of the route
// instead of being sandwiched between two fixed endpoints.
function improveWith2Opt(path: google.maps.LatLngLiteral[], fixLast: boolean): void {
  let improved = true;
  while (improved) {
    improved = false;
    const jMax = fixLast ? path.length - 2 : path.length - 1;
    for (let i = 1; i < path.length - 1; i++) {
      for (let j = i + 1; j <= jMax; j++) {
        const hasTailEdge = j < path.length - 1;
        const before =
          haversineKm(path[i - 1], path[i]) +
          (hasTailEdge ? haversineKm(path[j], path[j + 1]) : 0);
        const after =
          haversineKm(path[i - 1], path[j]) +
          (hasTailEdge ? haversineKm(path[i], path[j + 1]) : 0);
        if (after + 1e-9 < before) {
          let lo = i;
          let hi = j;
          while (lo < hi) {
            [path[lo], path[hi]] = [path[hi], path[lo]];
            lo++;
            hi--;
          }
          improved = true;
        }
      }
    }
  }
}

// Reorders stops to minimize total straight-line distance for the day
// (matches "自動安排最順路線" — no Directions calls, no per-mode
// limitation, just geography). Nearest-neighbor gives a starting order,
// then 2-opt cleans up the obvious crossings/detours it tends to leave
// behind.
//
// Without an anchor: first and last stop stay fixed, only the interior
// gets reordered. This is wrong when neither the current first nor last
// stop is a real "must start/end here" point — e.g. 4 stops where 3 are
// clustered and 1 is a distant outlier, with the outlier stuck between two
// fixed nearby endpoints, forces a there-and-back detour no reordering of
// the interior can avoid.
//
// With an anchor (e.g. the day's hotel): the anchor is treated as a fixed
// starting point that never appears in the output, and ALL real stops
// (including whichever was first/last) become free to reorder — so an
// outlier can end up at the end of the route instead of the middle.
export function optimizeStopOrder<T extends google.maps.LatLngLiteral>(
  points: T[],
  anchor?: google.maps.LatLngLiteral
): T[] {
  function nearestNeighborOrder(start: google.maps.LatLngLiteral, pool: T[]): T[] {
    const remaining = [...pool];
    const ordered: T[] = [];
    let current = start;
    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const distance = haversineKm(current, remaining[i]);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }
      const [next] = remaining.splice(nearestIndex, 1);
      ordered.push(next);
      current = next;
    }
    return ordered;
  }

  if (anchor) {
    if (points.length <= 1) return points;
    const ordered = nearestNeighborOrder(anchor, points);
    const path: google.maps.LatLngLiteral[] = [anchor, ...ordered];
    improveWith2Opt(path, false);
    return path.slice(1) as T[];
  }

  if (points.length <= 2) return points;

  const first = points[0];
  const last = points[points.length - 1];
  const ordered = nearestNeighborOrder(first, points.slice(1, -1));
  const path = [first, ...ordered, last];
  improveWith2Opt(path, true);
  return path;
}

export type TransitStepSummary = {
  mode: "WALK" | "TRANSIT";
  vehicleType?: string; // google.maps.VehicleType, e.g. "SUBWAY", "BUS", "TRAM"
  lineName?: string;
  stops?: number;
  durationMin: number;
  // Official line colors (e.g. Taipei Metro's red/blue/green lines,
  // Kaohsiung MRT/light rail) — comes straight from Google's transit data
  // (TransitLine.color/text_color) when the agency publishes one. Bus
  // routes and agencies that don't brand their lines this way just won't
  // have it, so this is optional and the UI needs a fallback.
  color?: string;
  textColor?: string;
};

export type TransitAlternative = {
  summary: string;
  durationMin: number;
  distanceKm: number;
  fareText?: string;
  steps: TransitStepSummary[];
};

function summarizeSteps(steps: google.maps.DirectionsStep[]): TransitStepSummary[] {
  return steps.map((step) => {
    const durationMin = step.duration ? Math.round(step.duration.value / 60) : 0;
    const transit = step.transit_details ?? step.transit;
    if (step.travel_mode === "TRANSIT" && transit) {
      return {
        mode: "TRANSIT" as const,
        vehicleType: transit.line?.vehicle?.type,
        lineName: transit.line?.short_name || transit.line?.name,
        stops: transit.num_stops,
        durationMin,
        color: transit.line?.color,
        textColor: transit.line?.text_color,
      };
    }
    return { mode: "WALK" as const, durationMin };
  });
}

// Fetches every transit itinerary Google offers for a leg (subway vs. bus
// vs. mixed, etc.) so the UI can let the user pick one instead of silently
// taking whichever Directions returns first.
export async function fetchTransitAlternatives(
  directionsService: google.maps.DirectionsService,
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  region?: string
): Promise<TransitAlternative[]> {
  if (!isGoogleTransitSupported(region)) return [];
  try {
    const result = await directionsService.route({
      origin,
      destination,
      travelMode: GOOGLE_TRAVEL_MODE.TRANSIT,
      region,
      language: "zh-TW",
      provideRouteAlternatives: true,
      transitOptions: { departureTime: new Date() },
    });
    return result.routes
      .map((route): TransitAlternative | null => {
        const leg = route.legs[0];
        if (!leg?.duration || !leg?.distance) return null;
        const steps = summarizeSteps(leg.steps ?? []);
        // A route Google hands back for a TRANSIT request that turns out
        // to have zero actual transit legs isn't a real alternative — it
        // just means the hop is short enough that walking beat waiting
        // for any bus/train (common for e.g. two stops in the same small
        // area). Showing that here would look like a broken "transit
        // suggestion" that's actually just walking directions, so this
        // is treated the same as Google not finding anything.
        if (!steps.some((s) => s.mode === "TRANSIT")) return null;
        return {
          summary: route.summary || "",
          durationMin: Math.round(leg.duration.value / 60),
          distanceKm: Math.round((leg.distance.value / 1000) * 10) / 10,
          fareText: route.fare?.text,
          steps,
        };
      })
      .filter((a): a is TransitAlternative => a != null);
  } catch {
    return [];
  }
}
