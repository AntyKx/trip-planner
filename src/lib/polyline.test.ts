import { describe, expect, it } from "vitest";
import { decodePolyline, isEncodedPolyline, polylineMatchesEndpoints } from "./polyline";

describe("decodePolyline", () => {
  it("decodes Google's documented example", () => {
    // From the Encoded Polyline Algorithm Format page.
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it("returns no points for an empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });

  it("stops at a truncated trailing point instead of emitting garbage", () => {
    expect(decodePolyline("_p~iF~ps|U_ulL")).toEqual([{ lat: 38.5, lng: -120.2 }]);
  });
});

describe("isEncodedPolyline", () => {
  it("accepts real encoded polylines and the empty string", () => {
    expect(isEncodedPolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toBe(true);
    expect(isEncodedPolyline("")).toBe(true);
  });

  it("rejects characters outside the encoding's range", () => {
    expect(isEncodedPolyline("abc def")).toBe(false);
    expect(isEncodedPolyline("<script>")).toBe(false);
    expect(isEncodedPolyline("中文")).toBe(false);
  });
});

describe("polylineMatchesEndpoints", () => {
  // Google's example line: (38.5,-120.2) -> (40.7,-120.95) -> (43.252,-126.453)
  const line = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

  it("accepts a line whose ends are at the two stops", () => {
    expect(
      polylineMatchesEndpoints(line, { lat: 38.5, lng: -120.2 }, { lat: 43.252, lng: -126.453 })
    ).toBe(true);
  });

  it("allows a little slack for road snapping", () => {
    expect(
      polylineMatchesEndpoints(line, { lat: 38.502, lng: -120.2 }, { lat: 43.252, lng: -126.45 })
    ).toBe(true);
  });

  it("rejects a cached line once a stop has moved to a different place", () => {
    expect(
      polylineMatchesEndpoints(line, { lat: 38.6, lng: -120.2 }, { lat: 43.252, lng: -126.453 })
    ).toBe(false);
  });

  it("rejects an empty or one-point line", () => {
    expect(polylineMatchesEndpoints("", { lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(false);
  });
});
