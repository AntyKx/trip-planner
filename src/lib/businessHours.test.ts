import { describe, it, expect } from "vitest";
import {
  parseOpeningPeriods,
  isClosedAllDay,
  isTimeOutsideHours,
  weekdayLabel,
  type OpeningPeriod,
} from "./businessHours";

describe("parseOpeningPeriods", () => {
  it("returns [] for undefined input", () => {
    expect(parseOpeningPeriods(undefined)).toEqual([]);
  });

  it("converts a same-day period to minutes-since-midnight", () => {
    const result = parseOpeningPeriods([
      { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 18, minute: 0 } },
    ]);
    expect(result).toEqual([{ day: 1, openMinutes: 540, closeMinutes: 1080 }]);
  });

  it("has no closeMinutes for a 24-hour place (no close point)", () => {
    const result = parseOpeningPeriods([{ open: { day: 0, hour: 0, minute: 0 } }]);
    expect(result).toEqual([{ day: 0, openMinutes: 0, closeMinutes: null }]);
  });

  it("carries an overnight period past midnight (Fri 18:00 -> Sat 02:00)", () => {
    const result = parseOpeningPeriods([
      { open: { day: 5, hour: 18, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } },
    ]);
    // 2:00 the next day = 120 + 1440 = 1560 minutes past the open day's midnight.
    expect(result).toEqual([{ day: 5, openMinutes: 1080, closeMinutes: 1560 }]);
  });

  it("treats close.day === open.day with an earlier clock time as running to end of day", () => {
    // Google's convention for "closes at midnight": close day equals open
    // day, close hour/minute is 0:00 — that's actually the *next* midnight.
    const result = parseOpeningPeriods([
      { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 0, minute: 0 } },
    ]);
    expect(result).toEqual([{ day: 1, openMinutes: 540, closeMinutes: 1440 }]);
  });
});

describe("isClosedAllDay", () => {
  it("returns false when there's no hours data at all", () => {
    expect(isClosedAllDay([], new Date(2026, 0, 1))).toBe(false);
  });

  it("returns false for a 24-hour place regardless of date", () => {
    const periods: OpeningPeriod[] = [{ day: 3, openMinutes: 0, closeMinutes: null }];
    expect(isClosedAllDay(periods, new Date(2026, 0, 1))).toBe(false);
  });

  it("returns false when the date's weekday has a period", () => {
    const monday = new Date(2026, 0, 5);
    const periods: OpeningPeriod[] = [
      { day: monday.getDay(), openMinutes: 540, closeMinutes: 1080 },
    ];
    expect(isClosedAllDay(periods, monday)).toBe(false);
  });

  it("returns true when the date's weekday has no period and nothing spills over", () => {
    const monday = new Date(2026, 0, 5);
    const tuesday = new Date(monday);
    tuesday.setDate(monday.getDate() + 1);
    const periods: OpeningPeriod[] = [
      { day: monday.getDay(), openMinutes: 540, closeMinutes: 1080 },
    ];
    expect(isClosedAllDay(periods, tuesday)).toBe(true);
  });

  it("returns false when the previous day's overnight period spills into this date", () => {
    const friday = new Date(2026, 0, 2);
    const saturday = new Date(friday);
    saturday.setDate(friday.getDate() + 1);
    // Friday 18:00 -> Saturday 02:00 — nothing is scheduled directly on
    // Saturday, but the spillover should still count as "open."
    const periods: OpeningPeriod[] = [
      { day: friday.getDay(), openMinutes: 1080, closeMinutes: 1560 },
    ];
    expect(isClosedAllDay(periods, saturday)).toBe(false);
  });
});

describe("isTimeOutsideHours", () => {
  it("returns false when there's no hours data", () => {
    expect(isTimeOutsideHours([], new Date(2026, 0, 1), "12:00")).toBe(false);
  });

  it("returns false for a 24-hour place regardless of time", () => {
    const periods: OpeningPeriod[] = [{ day: 3, openMinutes: 0, closeMinutes: null }];
    expect(isTimeOutsideHours(periods, new Date(2026, 0, 1), "03:00")).toBe(false);
  });

  it("returns false for a time within the day's period", () => {
    const monday = new Date(2026, 0, 5);
    const periods: OpeningPeriod[] = [
      { day: monday.getDay(), openMinutes: 540, closeMinutes: 1080 },
    ]; // 09:00-18:00
    expect(isTimeOutsideHours(periods, monday, "12:00")).toBe(false);
  });

  it("returns true for a time before opening or after closing", () => {
    const monday = new Date(2026, 0, 5);
    const periods: OpeningPeriod[] = [
      { day: monday.getDay(), openMinutes: 540, closeMinutes: 1080 },
    ]; // 09:00-18:00
    expect(isTimeOutsideHours(periods, monday, "08:00")).toBe(true);
    expect(isTimeOutsideHours(periods, monday, "21:00")).toBe(true);
  });

  it("covers a time in the early morning via the previous day's overnight spillover", () => {
    const friday = new Date(2026, 0, 2);
    const saturday = new Date(friday);
    saturday.setDate(friday.getDate() + 1);
    // Friday 18:00 -> Saturday 02:00.
    const periods: OpeningPeriod[] = [
      { day: friday.getDay(), openMinutes: 1080, closeMinutes: 1560 },
    ];
    expect(isTimeOutsideHours(periods, saturday, "01:00")).toBe(false);
    expect(isTimeOutsideHours(periods, saturday, "03:00")).toBe(true);
  });

  it("returns false for an unparseable time instead of throwing", () => {
    const periods: OpeningPeriod[] = [{ day: 1, openMinutes: 540, closeMinutes: 1080 }];
    expect(isTimeOutsideHours(periods, new Date(2026, 0, 5), "not-a-time")).toBe(false);
  });
});

describe("weekdayLabel", () => {
  it("maps every day of the week to its 週X label in order", () => {
    const labels = ["日", "一", "二", "三", "四", "五", "六"];
    const base = new Date(2026, 0, 4);
    const baseDayIndex = base.getDay();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const expected = `週${labels[(baseDayIndex + i) % 7]}`;
      expect(weekdayLabel(d)).toBe(expected);
    }
  });
});
