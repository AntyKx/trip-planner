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
