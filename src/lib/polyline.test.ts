import { describe, expect, it } from "vitest";
import { decodePolyline, isEncodedPolyline } from "./polyline";

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
