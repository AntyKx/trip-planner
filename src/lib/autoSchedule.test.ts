import { describe, it, expect } from "vitest";
import { buildDaySchedule, type ScheduleItem } from "./autoSchedule";
import type { OpeningPeriod } from "./businessHours";

// 2024-01-01 is a Monday (day: 1).
const MONDAY = "2024-01-01";

function periodsJson(periods: OpeningPeriod[]): string {
  return JSON.stringify(periods);
}

function placeItem(
  id: string,
  overrides: Partial<ScheduleItem> = {},
  openHours: string | null = null
): ScheduleItem {
  return {
    id,
    type: "PLACE",
    startTime: null,
    endTime: null,
    place: { name: id, openHours },
    note: null,
    ...overrides,
  };
}

describe("buildDaySchedule - basic packing", () => {
  it("packs items sequentially from the day start using route durations", () => {
    const proposals = buildDaySchedule(
      [placeItem("A"), placeItem("B")],
      [{ fromItemId: "A", toItemId: "B", durationMin: 30 }],
      MONDAY,
      "09:00"
    );

    expect(proposals[0]).toMatchObject({ newStart: "09:00", newEnd: "10:30" });
    // 10:30 depart + 30 min transit = 11:00 arrive
    expect(proposals[1]).toMatchObject({ newStart: "11:00", newEnd: "12:30" });
  });

  it("uses a fallback buffer when no route exists between two items", () => {
    const proposals = buildDaySchedule(
      [placeItem("A"), placeItem("B")],
      [],
      MONDAY,
      "09:00"
    );

    // 10:30 depart + 10 min fallback = 10:40 arrive
    expect(proposals[1].newStart).toBe("10:40");
  });

  it("uses type-specific default durations", () => {
    const proposals = buildDaySchedule(
      [placeItem("餐廳", { type: "RESTAURANT" })],
      [],
      MONDAY,
      "12:00"
    );

    expect(proposals[0].newEnd).toBe("13:15"); // 75 min
  });
});

describe("buildDaySchedule - opening hours", () => {
  it("delays arrival until the place opens", () => {
    const openHours = periodsJson([{ day: 1, openMinutes: 600, closeMinutes: 1080 }]); // 10:00-18:00
    const proposals = buildDaySchedule(
      [placeItem("晚開景點", {}, openHours)],
      [],
      MONDAY,
      "08:00"
    );

    expect(proposals[0].newStart).toBe("10:00");
    expect(proposals[0].warning).toBeNull();
  });

  it("warns when the place is closed all day", () => {
    const openHours = periodsJson([{ day: 2, openMinutes: 600, closeMinutes: 1080 }]); // Tue only
    const proposals = buildDaySchedule(
      [placeItem("週一公休", {}, openHours)],
      [],
      MONDAY,
      "10:00"
    );

    expect(proposals[0].warning).toContain("公休");
  });

  it("caps the stay at closing time instead of overrunning it", () => {
    const openHours = periodsJson([{ day: 1, openMinutes: 540, closeMinutes: 1080 }]); // 09:00-18:00
    const proposals = buildDaySchedule(
      [placeItem("快打烊", {}, openHours)],
      [],
      MONDAY,
      "17:30"
    );

    expect(proposals[0].newStart).toBe("17:30");
    expect(proposals[0].newEnd).toBe("18:00"); // capped, not 19:00 (17:30 + 90min default)
    expect(proposals[0].warning).toContain("打烊");
  });

  it("skips a lunch-break gap instead of treating the first opening as open all day", () => {
    // Open 09:00-12:00 and 14:00-18:00 — arriving at 12:30 used to be
    // treated as "open" because it's after the day's earliest opening.
    const openHours = periodsJson([
      { day: 1, openMinutes: 540, closeMinutes: 720 },
      { day: 1, openMinutes: 840, closeMinutes: 1080 },
    ]);
    const proposals = buildDaySchedule(
      [placeItem("午休店家", {}, openHours)],
      [],
      MONDAY,
      "12:30"
    );

    expect(proposals[0].newStart).toBe("14:00");
    expect(proposals[0].newEnd).toBe("15:30"); // 90min default, well within 14:00-18:00
    expect(proposals[0].warning).toBeNull();
  });

  it("warns without capping when arrival is after all of today's hours", () => {
    const openHours = periodsJson([{ day: 1, openMinutes: 540, closeMinutes: 1080 }]); // 09:00-18:00
    const proposals = buildDaySchedule(
      [placeItem("已打烊", {}, openHours)],
      [],
      MONDAY,
      "19:00"
    );

    expect(proposals[0].newStart).toBe("19:00");
    expect(proposals[0].warning).toContain("打烊");
  });
});

describe("buildDaySchedule - fixed TRANSPORT anchors", () => {
  it("waits for a fixed transport and resumes from its end", () => {
    const proposals = buildDaySchedule(
      [
        placeItem("A"),
        {
          id: "flight",
          type: "TRANSPORT",
          startTime: `${MONDAY}T13:00:00Z`,
          endTime: `${MONDAY}T15:00:00Z`,
          place: null,
          note: "飛機",
        },
        placeItem("B"),
      ],
      [],
      MONDAY,
      "09:00"
    );

    expect(proposals[1]).toMatchObject({
      fixed: true,
      newStart: "13:00",
      newEnd: "15:00",
      warning: null,
    });
    // B starts after the flight lands (+ fallback transit)
    expect(proposals[2].newStart).toBe("15:10");
  });

  it("keeps the transport's times but warns when the schedule overruns it", () => {
    const proposals = buildDaySchedule(
      [
        placeItem("A"), // 09:00-10:30
        {
          id: "train",
          type: "TRANSPORT",
          startTime: `${MONDAY}T09:30:00Z`,
          endTime: `${MONDAY}T10:00:00Z`,
          place: null,
          note: "火車",
        },
      ],
      [],
      MONDAY,
      "09:00"
    );

    expect(proposals[1].fixed).toBe(true);
    expect(proposals[1].newStart).toBe("09:30");
    expect(proposals[1].warning).toContain("來不及");
  });

  it("treats a TRANSPORT item without times as a normal reschedulable item", () => {
    const proposals = buildDaySchedule(
      [
        {
          id: "bus",
          type: "TRANSPORT",
          startTime: null,
          endTime: null,
          place: null,
          note: "巴士",
        },
      ],
      [],
      MONDAY,
      "09:00"
    );

    expect(proposals[0].fixed).toBe(false);
    expect(proposals[0]).toMatchObject({ newStart: "09:00", newEnd: "09:30" });
  });
});

describe("buildDaySchedule - overflow", () => {
  it("clamps past-midnight times and warns", () => {
    const proposals = buildDaySchedule(
      [placeItem("A"), placeItem("B")],
      [],
      MONDAY,
      "23:00"
    );

    expect(proposals[1].warning).toContain("排不下");
    expect(proposals[1].newEnd).toBe("23:59");
  });
});
