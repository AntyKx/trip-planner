import { describe, it, expect } from "vitest";
import { getDestinationTemplates, DESTINATION_TEMPLATES } from "./checklistTemplates";

describe("getDestinationTemplates", () => {
  it("returns nothing for an empty list", () => {
    expect(getDestinationTemplates([])).toEqual([]);
  });

  it("returns nothing for an unknown/unlisted country", () => {
    expect(getDestinationTemplates(["FR"])).toEqual([]);
  });

  it("matches a known country's template exactly", () => {
    expect(getDestinationTemplates(["JP"])).toEqual(DESTINATION_TEMPLATES.JP);
  });

  it("is case-insensitive", () => {
    expect(getDestinationTemplates(["jp"])).toEqual(DESTINATION_TEMPLATES.JP);
  });

  it("de-duplicates repeated countries instead of doubling the entries", () => {
    expect(getDestinationTemplates(["JP", "JP"])).toEqual(DESTINATION_TEMPLATES.JP);
  });

  it("skips empty/whitespace-only entries", () => {
    expect(getDestinationTemplates(["", "  ", "TW"])).toEqual(DESTINATION_TEMPLATES.TW);
  });

  it("combines multiple countries' templates in first-seen order", () => {
    expect(getDestinationTemplates(["JP", "KR"])).toEqual([
      ...DESTINATION_TEMPLATES.JP,
      ...DESTINATION_TEMPLATES.KR,
    ]);
  });

  it("produces sourceKeys that are unique across the whole template set", () => {
    // generateChecklistForTrip relies on sourceKey uniqueness (DB-enforced
    // via @@unique([tripId, sourceKey])) to dedupe re-generation — a
    // collision here would silently drop one destination's item.
    const allKeys = Object.values(DESTINATION_TEMPLATES)
      .flat()
      .map((entry) => entry.sourceKey);
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });
});
