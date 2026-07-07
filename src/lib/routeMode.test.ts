import { describe, it, expect } from "vitest";
import { isGoogleTransitSupported, optimizeStopOrder } from "./routeMode";

describe("isGoogleTransitSupported", () => {
  it("is false for Japan and India, case-insensitively", () => {
    expect(isGoogleTransitSupported("JP")).toBe(false);
    expect(isGoogleTransitSupported("jp")).toBe(false);
    expect(isGoogleTransitSupported("IN")).toBe(false);
    expect(isGoogleTransitSupported("in")).toBe(false);
  });

  it("is true for other countries, and for missing/empty input", () => {
    expect(isGoogleTransitSupported("TW")).toBe(true);
    expect(isGoogleTransitSupported("US")).toBe(true);
    expect(isGoogleTransitSupported(undefined)).toBe(true);
    expect(isGoogleTransitSupported("")).toBe(true);
  });
});

describe("optimizeStopOrder", () => {
  it("returns points unchanged when there are 2 or fewer (no anchor)", () => {
    const points = [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }];
    expect(optimizeStopOrder(points)).toEqual(points);
  });

  it("returns the single point unchanged when there's just one (with anchor)", () => {
    const points = [{ lat: 1, lng: 1 }];
    expect(optimizeStopOrder(points, { lat: 0, lng: 0 })).toEqual(points);
  });

  it("keeps first/last fixed and sorts the interior by proximity without an anchor", () => {
    const a = { lat: 0, lng: 0 };
    const c = { lat: 0, lng: 2 }; // farther from a than b is
    const b = { lat: 0, lng: 1 };
    const d = { lat: 0, lng: 3 };
    // Input interior order is [c, b] — deliberately "wrong" — a/d are the
    // fixed endpoints since there's no anchor.
    const result = optimizeStopOrder([a, c, b, d]);
    expect(result).toEqual([a, b, c, d]);
  });

  it("without an anchor, a fixed endpoint stays fixed even if it strands an outlier in the interior", () => {
    // This is the exact problem the day-anchor feature exists to solve —
    // see project_route_anchor_feature. first/last are taken verbatim from
    // the input array regardless of geography.
    const near1 = { lat: 0, lng: 0 }; // forced first
    const outlier = { lat: 0, lng: 10 };
    const near2 = { lat: 0, lng: 1 };
    const near3 = { lat: 0, lng: 3 }; // forced last
    const result = optimizeStopOrder([near1, outlier, near2, near3]);
    expect(result[0]).toEqual(near1);
    expect(result[result.length - 1]).toEqual(near3);
  });

  it("with an anchor, every real stop is free to reorder — an outlier ends up last instead of sandwiched", () => {
    const anchor = { lat: 0, lng: 0 };
    const near1 = { lat: 0, lng: 1 };
    const near2 = { lat: 0, lng: 2 };
    const outlier = { lat: 0, lng: 10 };
    // Outlier is deliberately passed in the middle of the input.
    const result = optimizeStopOrder([near1, outlier, near2], anchor);
    expect(result).toEqual([near1, near2, outlier]);
  });

  it("with an anchor, actually reorders points instead of just passing them through", () => {
    const anchor = { lat: 0, lng: 0 };
    const far = { lat: 0, lng: 5 };
    const near = { lat: 0, lng: 1 };
    // Input order is [far, near] — nearest-neighbor from the anchor should
    // flip this to [near, far].
    const result = optimizeStopOrder([far, near], anchor);
    expect(result).toEqual([near, far]);
  });
});
