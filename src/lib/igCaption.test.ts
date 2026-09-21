import { describe, it, expect } from "vitest";
import { toHashtag, buildItemCaption, buildTripCaption, IG_MAX_CAPTION } from "./igCaption";

const item = {
  id: "i1",
  type: "ATTRACTION",
  note: null,
  journalText: "人超多但很值得",
  place: { name: "淺草寺 Senso-ji", address: null },
  photos: [],
};

describe("toHashtag", () => {
  it("strips spaces and punctuation, keeps CJK", () => {
    expect(toHashtag("淺草寺 Senso-ji")).toBe("#淺草寺Sensoji");
  });
  it("returns null when nothing usable remains", () => {
    expect(toHashtag(" -- ")).toBeNull();
  });
});

describe("buildItemCaption", () => {
  it("has name, text and hashtags", () => {
    const out = buildItemCaption(item, "東京 5 日");
    expect(out).toContain("📍 淺草寺 Senso-ji");
    expect(out).toContain("人超多但很值得");
    expect(out).toContain("#淺草寺Sensoji");
    expect(out).toContain("#東京5日");
  });
});

describe("buildTripCaption", () => {
  const trip = {
    title: "東京",
    startDate: new Date(),
    endDate: new Date(),
    coverImage: null,
    days: [
      {
        id: "d1",
        dayIndex: 1,
        date: new Date(),
        items: [item, { ...item, id: "i2", journalText: null }],
      },
    ],
  };
  it("skips stops without journal text", () => {
    const out = buildTripCaption(trip);
    expect(out).toContain("— Day 1 —");
    // one 📍 line in the body (the second stop has no journal text)
    expect(out.match(/📍/g)?.length).toBe(1);
  });
  it("stays within the IG limit and keeps hashtags when too long", () => {
    const long = {
      ...trip,
      days: [{ ...trip.days[0], items: [{ ...item, journalText: "字".repeat(5000) }] }],
    };
    const out = buildTripCaption(long);
    expect(out.length).toBeLessThanOrEqual(IG_MAX_CAPTION);
    expect(out).toContain("#東京");
  });
});
