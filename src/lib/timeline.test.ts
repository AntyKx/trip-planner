import { describe, it, expect } from "vitest";
import { getNextStop } from "./timeline";
import type { TimelineItem } from "@/components/DayTimeline";

function item(id: string, startTime: string | null): TimelineItem {
  return {
    id,
    type: "PLACE",
    startTime,
    endTime: null,
    note: null,
    confirmationNumber: null,
    costs: [],
    journalText: null,
    photos: [],
    place: null,
  };
}

// Times in this app are wall-clock values stored as if they were UTC —
// so the injected "now" below is encoded the same way (see timeline.ts).
const NOON = Date.UTC(2026, 6, 7, 12, 0, 0);

describe("getNextStop", () => {
  it("returns the first stop at or after now", () => {
    const items = [
      item("a", "2026-07-07T09:00:00Z"),
      item("b", "2026-07-07T14:00:00Z"),
      item("c", "2026-07-07T18:00:00Z"),
    ];
    expect(getNextStop(items, NOON)?.id).toBe("b");
  });

  it("does not treat an already-passed stop as upcoming", () => {
    // Regression: comparing stored wall-clock times against the real
    // epoch made a 09:00 stop still count as "next" at local noon for
    // any viewer east of UTC.
    const items = [item("a", "2026-07-07T09:00:00Z")];
    expect(getNextStop(items, NOON)?.id).toBe("a"); // falls back to last
    const items2 = [
      item("a", "2026-07-07T09:00:00Z"),
      item("b", "2026-07-07T10:00:00Z"),
    ];
    // Both passed — the *last* one is returned as fallback, not the first
    // "still upcoming by epoch math" one.
    expect(getNextStop(items2, NOON)?.id).toBe("b");
  });

  it("sorts by time rather than array order", () => {
    const items = [
      item("late", "2026-07-07T18:00:00Z"),
      item("early", "2026-07-07T13:00:00Z"),
    ];
    expect(getNextStop(items, NOON)?.id).toBe("early");
  });

  it("falls back to the first item when nothing has a time", () => {
    const items = [item("a", null), item("b", null)];
    expect(getNextStop(items, NOON)?.id).toBe("a");
  });

  it("returns null for an empty day", () => {
    expect(getNextStop([], NOON)).toBeNull();
  });
});
