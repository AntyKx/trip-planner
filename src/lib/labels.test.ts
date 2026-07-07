import { describe, it, expect } from "vitest";
import { formatStayDuration } from "./labels";

describe("formatStayDuration", () => {
  it("returns null when either end is missing", () => {
    expect(formatStayDuration(null, "2026-01-01T10:00:00Z")).toBeNull();
    expect(formatStayDuration("2026-01-01T09:00:00Z", null)).toBeNull();
  });

  it("returns null when end is not after start", () => {
    expect(
      formatStayDuration("2026-01-01T10:00:00Z", "2026-01-01T10:00:00Z")
    ).toBeNull();
    expect(
      formatStayDuration("2026-01-01T10:00:00Z", "2026-01-01T09:00:00Z")
    ).toBeNull();
  });

  it("formats whole hours without a minutes remainder", () => {
    expect(
      formatStayDuration("2026-01-01T09:00:00Z", "2026-01-01T11:00:00Z")
    ).toBe("停留 2 小時");
  });

  it("formats minutes-only durations under an hour", () => {
    expect(
      formatStayDuration("2026-01-01T09:00:00Z", "2026-01-01T09:45:00Z")
    ).toBe("停留 45 分鐘");
  });

  it("formats a mixed hours-and-minutes duration", () => {
    expect(
      formatStayDuration("2026-01-01T09:00:00Z", "2026-01-01T10:30:00Z")
    ).toBe("停留 1 小時 30 分鐘");
  });
});
