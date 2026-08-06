import { describe, it, expect } from "vitest";
import { suggestDayForPlace } from "./daySuggestion";

// Roughly Madrid vs Barcelona, ~500km apart — real cities so the distances
// involved are unambiguous relative to each other, not just synthetic units.
const MADRID = { lat: 40.4168, lng: -3.7038 };
const MADRID_NEARBY = { lat: 40.42, lng: -3.71 };
const BARCELONA = { lat: 41.3874, lng: 2.1686 };

describe("suggestDayForPlace", () => {
  it("picks the day whose closest existing place is nearest", () => {
    const days = [
      { id: "day-madrid", places: [MADRID] },
      { id: "day-barcelona", places: [BARCELONA] },
    ];
    expect(suggestDayForPlace(MADRID_NEARBY, days)).toBe("day-madrid");
  });

  it("uses nearest single item, not a day's average position", () => {
    // day-mixed's items straddle Madrid and Barcelona, so its centroid
    // would sit somewhere in between — nowhere near the actual candidate.
    // The nearest-item rule should still catch that one of its items (the
    // Madrid one) is right next door.
    const days = [
      { id: "day-mixed", places: [MADRID, BARCELONA] },
      { id: "day-far", places: [{ lat: 48.8566, lng: 2.3522 }] }, // Paris
    ];
    expect(suggestDayForPlace(MADRID_NEARBY, days)).toBe("day-mixed");
  });

  it("returns null when no day has any places yet", () => {
    const days = [
      { id: "day-1", places: [] },
      { id: "day-2", places: [] },
    ];
    expect(suggestDayForPlace(MADRID, days)).toBeNull();
  });

  it("returns null for an empty day list", () => {
    expect(suggestDayForPlace(MADRID, [])).toBeNull();
  });

  it("skips days with no places when others have some", () => {
    const days = [
      { id: "day-empty", places: [] },
      { id: "day-barcelona", places: [BARCELONA] },
    ];
    expect(suggestDayForPlace(BARCELONA, days)).toBe("day-barcelona");
  });

  it("returns null when the nearest day is still unreasonably far away", () => {
    // Real report: a trip with only one populated day (a Miyajima torii
    // gate near Hiroshima) recommended itself for a newly searched Asakusa,
    // Tokyo place — ~800km away — purely for being the least-far of the
    // only day with any data at all.
    const asakusa = { lat: 35.7148, lng: 139.7967 };
    const miyajimaToriiGate = { lat: 34.2969, lng: 132.3197 };
    const days = [{ id: "day-hiroshima", places: [miyajimaToriiGate] }];
    expect(suggestDayForPlace(asakusa, days)).toBeNull();
  });

  it("still suggests a day whose nearest item is within a reasonable day-trip range", () => {
    // Tokyo <-> Hakone, a realistic same-trip day-trip distance (~80km).
    const shinjuku = { lat: 35.6896, lng: 139.6995 };
    const hakone = { lat: 35.2323, lng: 139.1069 };
    const days = [{ id: "day-tokyo", places: [shinjuku] }];
    expect(suggestDayForPlace(hakone, days)).toBe("day-tokyo");
  });
});
