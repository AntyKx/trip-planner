import { describe, expect, it } from "vitest";
import { footprintOf, tripCover, tripHasJournal, tripPhotoCount, tripPlaceIds } from "./tripSummary";

const place = (id: string, country = "JP", photoUrl: string | null = null) => ({
  id,
  country,
  photoUrl,
});
const item = (p: ReturnType<typeof place> | null, photos = 0, journalText: string | null = null) => ({
  place: p,
  _count: { photos },
  journalText,
});

describe("tripSummary", () => {
  const kyoto = {
    coverImage: null,
    days: [
      { items: [item(place("hotel", "JP")), item(place("temple", "jp", "t.jpg"), 3)] },
      { items: [item(place("hotel", "JP")), item(null)] },
    ],
  };

  it("counts distinct places, so a multi-night hotel counts once", () => {
    expect(tripPlaceIds(kyoto).size).toBe(2);
  });

  it("sums photos across stops", () => {
    expect(tripPhotoCount(kyoto)).toBe(3);
  });

  it("falls back to the first stop photo when there's no cover", () => {
    expect(tripCover(kyoto)).toBe("t.jpg");
    expect(tripCover({ ...kyoto, coverImage: "c.jpg" })).toBe("c.jpg");
  });

  it("aggregates a footprint across trips, case-insensitive countries", () => {
    const seoul = { coverImage: null, days: [{ items: [item(place("palace", "KR"))] }] };
    expect(footprintOf([kyoto, seoul])).toEqual({ countries: 2, trips: 2, places: 3, photos: 3 });
  });

  it("only treats a trip as having a journal if something was written or photographed", () => {
    expect(tripHasJournal(kyoto)).toBe(true);
    const bare = { coverImage: null, days: [{ items: [item(place("a")), item(place("b"), 0, "  ")] }] };
    expect(tripHasJournal(bare)).toBe(false);
    const written = { coverImage: null, days: [{ items: [item(place("a"), 0, "好吃")] }] };
    expect(tripHasJournal(written)).toBe(true);
  });
});
