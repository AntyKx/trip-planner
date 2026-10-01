import { describe, expect, it } from "vitest";
import {
  agodaUrl,
  detectBookingCity,
  findBookingCity,
  googleFlightsUrl,
  klookUrl,
  nightsBetween,
} from "./bookingLinks";

describe("detectBookingCity", () => {
  it("takes the city from the trip title first", () => {
    expect(detectBookingCity("首爾五天四夜", ["日本〒810 福岡縣福岡市"])?.name).toBe("首爾");
    expect(detectBookingCity("福岡7日", [])?.name).toBe("福岡");
    expect(detectBookingCity("東京WBC", [])?.name).toBe("東京");
  });

  it("recognises aliases", () => {
    expect(detectBookingCity("臺北週末", [])?.name).toBe("台北");
    expect(detectBookingCity("北海道賞雪", [])?.name).toBe("札幌");
  });

  it("falls back to the city named most often in stop addresses", () => {
    expect(
      detectBookingCity("秋天小旅行", [
        "日本〒604-8005 京都府京都市中京區",
        "日本〒605-0862 京都府京都市東山區",
        "日本〒530-0001 大阪府大阪市北區",
        null,
      ])?.name
    ).toBe("京都");
  });

  it("returns undefined rather than guessing", () => {
    expect(detectBookingCity("西班牙七日", [])).toBeUndefined();
    expect(detectBookingCity("畢業旅行", ["某個沒有對照的地址"])).toBeUndefined();
  });
});

describe("booking URLs", () => {
  const seoul = findBookingCity("首爾")!;

  it("counts nights between first and last day", () => {
    expect(nightsBetween("2026-12-20", "2026-12-24")).toBe(4);
    expect(nightsBetween("2026-12-31", "2027-01-02")).toBe(2);
  });

  // The exact formats that were opened and checked in a browser.
  it("builds the verified Google Flights URL", () => {
    expect(googleFlightsUrl({ en: "Taipei" }, seoul, "2026-12-20", "2026-12-24")).toBe(
      "https://www.google.com/travel/flights?q=Flights%20to%20Seoul%20from%20Taipei%20on%202026-12-20%20through%202026-12-24&hl=zh-TW&curr=TWD"
    );
  });

  it("builds the verified Agoda URL", () => {
    expect(agodaUrl(seoul, "2026-12-20", 4)).toBe(
      "https://www.agoda.com/zh-tw/search?city=14690&checkIn=2026-12-20&los=4&rooms=1&adults=2&children=0"
    );
  });

  it("builds the verified Klook URL", () => {
    expect(klookUrl(seoul)).toBe(
      "https://www.klook.com/zh-TW/search/result/?query=%E9%A6%96%E7%88%BE"
    );
  });
});
