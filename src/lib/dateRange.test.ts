import { describe, expect, it } from "vitest";
import { addDays, daySpan, monthGrid, monthsBetween, nextSelection, shortLabel } from "./dateRange";

describe("date helpers", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("counts days inclusively", () => {
    expect(daySpan("2026-10-12", "2026-10-14")).toBe(3);
    expect(daySpan("2026-10-12", "2026-10-12")).toBe(1);
  });

  it("formats a short label with the weekday", () => {
    expect(shortLabel("2026-10-12")).toBe("10/12 (一)");
  });

  it("pads a month grid so the 1st lands on its weekday", () => {
    // 2026-10-01 is a Thursday → 4 leading blanks
    const grid = monthGrid(2026, 9);
    expect(grid.cells.slice(0, 5)).toEqual([null, null, null, null, "2026-10-01"]);
    expect(grid.cells.filter(Boolean)).toHaveLength(31);
    expect(grid.label).toBe("2026 年 10 月");
  });

  it("lists months inclusively across a year boundary", () => {
    expect(monthsBetween("2026-11-20", "2027-02-01").map((m) => m.key)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });
});

describe("nextSelection", () => {
  const empty = { start: "", end: "" };

  it("first tap sets the start", () => {
    expect(nextSelection(empty, "2026-10-12", 180)).toEqual({ start: "2026-10-12", end: "" });
  });

  it("second tap after the start sets the end", () => {
    expect(nextSelection({ start: "2026-10-12", end: "" }, "2026-10-14", 180)).toEqual({
      start: "2026-10-12",
      end: "2026-10-14",
    });
  });

  it("second tap on the start itself makes a one-day trip", () => {
    expect(nextSelection({ start: "2026-10-12", end: "" }, "2026-10-12", 180)).toEqual({
      start: "2026-10-12",
      end: "2026-10-12",
    });
  });

  it("second tap before the start becomes the new start", () => {
    expect(nextSelection({ start: "2026-10-12", end: "" }, "2026-10-05", 180)).toEqual({
      start: "2026-10-05",
      end: "",
    });
  });

  it("a tap after a complete range starts over", () => {
    expect(
      nextSelection({ start: "2026-10-12", end: "2026-10-14" }, "2026-11-01", 180)
    ).toEqual({ start: "2026-11-01", end: "" });
  });

  it("ignores an end tap past the max span", () => {
    const current = { start: "2026-10-01", end: "" };
    expect(nextSelection(current, "2026-10-04", 3)).toBe(current);
    expect(nextSelection(current, "2026-10-03", 3)).toEqual({
      start: "2026-10-01",
      end: "2026-10-03",
    });
  });
});
