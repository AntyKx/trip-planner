import { describe, it, expect } from "vitest";
import { runTripDoctor, type DoctorDay } from "./tripDoctor";
import type { OpeningPeriod } from "./businessHours";

// 2024-01-01 is a Monday (day: 1).
const MONDAY = "2024-01-01";

function periodsJson(periods: OpeningPeriod[]): string {
  return JSON.stringify(periods);
}

function baseDay(overrides: Partial<DoctorDay> = {}): DoctorDay {
  return {
    id: "day-1",
    dayIndex: 1,
    date: MONDAY,
    weather: null,
    items: [],
    routes: [],
    ...overrides,
  };
}

describe("runTripDoctor - business hours", () => {
  it("flags a place closed all day on that weekday", () => {
    const day = baseDay({
      items: [
        {
          id: "i1",
          startTime: `${MONDAY}T05:00:00Z`,
          endTime: null,
          place: {
            name: "週二公休咖啡廳",
            // Only open Tuesday (day: 2), never Monday.
            openHours: periodsJson([{ day: 2, openMinutes: 540, closeMinutes: 1080 }]),
          },
        },
      ],
    });

    const findings = runTripDoctor([day]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("issue");
    expect(findings[0].message).toContain("公休");
  });

  it("flags a start time outside opening hours", () => {
    const day = baseDay({
      items: [
        {
          id: "i1",
          startTime: `${MONDAY}T21:00:00Z`, // 21:00, place closes at 18:00
          endTime: null,
          place: {
            name: "早鳥咖啡廳",
            openHours: periodsJson([{ day: 1, openMinutes: 540, closeMinutes: 1080 }]),
          },
        },
      ],
    });

    const findings = runTripDoctor([day]);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("打烊");
  });

  it("does not flag a time within opening hours", () => {
    const day = baseDay({
      items: [
        {
          id: "i1",
          startTime: `${MONDAY}T10:00:00Z`,
          endTime: null,
          place: {
            name: "正常景點",
            openHours: periodsJson([{ day: 1, openMinutes: 540, closeMinutes: 1080 }]),
          },
        },
      ],
    });

    expect(runTripDoctor([day])).toHaveLength(0);
  });

  it("skips items with unparseable openHours instead of throwing", () => {
    const day = baseDay({
      items: [
        {
          id: "i1",
          startTime: `${MONDAY}T10:00:00Z`,
          endTime: null,
          place: { name: "壞資料景點", openHours: "not json" },
        },
      ],
    });

    expect(() => runTripDoctor([day])).not.toThrow();
    expect(runTripDoctor([day])).toHaveLength(0);
  });
});

describe("runTripDoctor - transit gaps", () => {
  const placeA = { name: "景點 A", openHours: null };
  const placeB = { name: "景點 B", openHours: null };

  it("flags a gap shorter than the computed route duration", () => {
    const day = baseDay({
      items: [
        { id: "i1", startTime: null, endTime: `${MONDAY}T09:00:00Z`, place: placeA },
        { id: "i2", startTime: `${MONDAY}T09:10:00Z`, endTime: null, place: placeB },
      ],
      routes: [{ fromItemId: "i1", toItemId: "i2", durationMin: 30 }],
    });

    const findings = runTripDoctor([day]);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("30 分鐘");
    expect(findings[0].message).toContain("10 分鐘");
  });

  it("does not flag when the gap covers the route duration", () => {
    const day = baseDay({
      items: [
        { id: "i1", startTime: null, endTime: `${MONDAY}T09:00:00Z`, place: placeA },
        { id: "i2", startTime: `${MONDAY}T09:40:00Z`, endTime: null, place: placeB },
      ],
      routes: [{ fromItemId: "i1", toItemId: "i2", durationMin: 30 }],
    });

    expect(runTripDoctor([day])).toHaveLength(0);
  });

  it("skips the comparison when there is no route data yet", () => {
    const day = baseDay({
      items: [
        { id: "i1", startTime: null, endTime: `${MONDAY}T09:00:00Z`, place: placeA },
        { id: "i2", startTime: `${MONDAY}T09:05:00Z`, endTime: null, place: placeB },
      ],
      routes: [],
    });

    expect(runTripDoctor([day])).toHaveLength(0);
  });

  it("flags overlapping times even without route data", () => {
    const day = baseDay({
      items: [
        { id: "i1", startTime: null, endTime: `${MONDAY}T09:30:00Z`, place: placeA },
        { id: "i2", startTime: `${MONDAY}T09:00:00Z`, endTime: null, place: placeB },
      ],
      routes: [],
    });

    const findings = runTripDoctor([day]);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("重疊");
  });
});

describe("runTripDoctor - busy day", () => {
  function placeItem(id: string): DoctorDay["items"][number] {
    return { id, startTime: null, endTime: null, place: { name: id, openHours: null } };
  }

  it("does not flag a day at or under the threshold", () => {
    const day = baseDay({ items: Array.from({ length: 6 }, (_, i) => placeItem(`p${i}`)) });
    expect(runTripDoctor([day])).toHaveLength(0);
  });

  it("flags a day over the threshold", () => {
    const day = baseDay({ items: Array.from({ length: 7 }, (_, i) => placeItem(`p${i}`)) });
    const findings = runTripDoctor([day]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("notice");
  });
});

describe("runTripDoctor - weather", () => {
  it("surfaces weather reminders as notices", () => {
    const day = baseDay({ weather: { weatherCode: 61, maxTemp: 20, minTemp: 15 } });
    const findings = runTripDoctor([day]);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.severity === "notice")).toBe(true);
  });

  it("has no findings when weather is null", () => {
    const day = baseDay({ weather: null });
    expect(runTripDoctor([day])).toHaveLength(0);
  });
});
