import { describe, it, expect } from "vitest";
import { buildTripIcs, type IcsItemInput } from "./ics";

function item(overrides: Partial<IcsItemInput> = {}): IcsItemInput {
  return {
    id: "item-1",
    type: "PLACE",
    placeName: "淺草寺",
    placeAddress: "東京都台東区浅草2丁目3-1",
    note: null,
    confirmationNumber: null,
    startTime: "2026-07-15T09:00:00Z",
    endTime: "2026-07-15T10:30:00Z",
    ...overrides,
  };
}

describe("buildTripIcs", () => {
  it("emits a VEVENT with floating local time (no Z / TZID)", () => {
    const ics = buildTripIcs("東京行", [item()]);
    // Wall-clock stored as "09:00...Z" must come out as floating 090000,
    // not converted through a real UTC offset.
    expect(ics).toContain("DTSTART:20260715T090000\r\n");
    expect(ics).toContain("DTEND:20260715T103000\r\n");
    expect(ics).toContain("SUMMARY:淺草寺");
    expect(ics).toContain("LOCATION:東京都台東区浅草2丁目3-1");
  });

  it("skips items with no start time", () => {
    const ics = buildTripIcs("東京行", [item({ startTime: null })]);
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("omits DTEND when there is no end time", () => {
    const ics = buildTripIcs("東京行", [item({ endTime: null })]);
    expect(ics).toContain("DTSTART:20260715T090000");
    expect(ics).not.toContain("DTEND");
  });

  it("falls back to the type label when there is no place name", () => {
    const ics = buildTripIcs("東京行", [
      item({ placeName: null, type: "CUSTOM" }),
    ]);
    expect(ics).toContain("SUMMARY:自訂");
  });

  it("includes confirmation number and note in the description", () => {
    const ics = buildTripIcs("東京行", [
      item({ confirmationNumber: "ABC123", note: "記得帶護照" }),
    ]);
    expect(ics).toMatch(/DESCRIPTION:確認碼／訂位代號：ABC123\\n記得帶護照/);
  });

  it("escapes commas, semicolons and backslashes in text fields", () => {
    const ics = buildTripIcs("東京行", [
      item({ placeName: "A, B; C\\D" }),
    ]);
    expect(ics).toContain("SUMMARY:A\\, B\\; C\\\\D");
  });
});
