// Decodes Google's encoded polyline format (the `overview_polyline` string
// a Directions result carries) into lat/lng points. Hand-rolled instead of
// loading the Maps "geometry" library just for this — it's a short,
// well-specified algorithm, and keeping it a pure function means it can be
// unit-tested without the Maps script.
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    for (const axis of ["lat", "lng"] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        if (index >= encoded.length) return points; // truncated input
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === "lat") lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// Encoded polylines only ever use ASCII 63–126. Used to reject anything
// else before it's stored (see cacheRoutePolyline) — the value comes from
// the client, so it's checked rather than trusted.
export function isEncodedPolyline(value: string): boolean {
  return /^[\x3f-\x7e]*$/.test(value);
}

const ENDPOINT_TOLERANCE_KM = 0.5;

// Whether a cached line still belongs to these two stops. The cache is
// keyed by item ids + mode (Route rows), but a stop can change its place
// while keeping the same item id (e.g. swapping 本日起點 to a different
// hotel) — without this check the map kept drawing the old route. Google
// snaps a route's ends to the nearest road, so they're compared with some
// slack rather than exactly.
export function polylineMatchesEndpoints(
  encoded: string,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): boolean {
  const points = decodePolyline(encoded);
  if (points.length < 2) return false;
  return (
    distanceKm(points[0], from) <= ENDPOINT_TOLERANCE_KM &&
    distanceKm(points[points.length - 1], to) <= ENDPOINT_TOLERANCE_KM
  );
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
