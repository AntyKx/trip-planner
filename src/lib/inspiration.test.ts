import { describe, expect, it } from "vitest";
import { nextLongWeekend, rankDestinations, taiwanToday } from "./inspiration";

const none = new Set<string>();

describe("rankDestinations", () => {
  it("puts this month's seasonal picks first, with the reason", () => {
    const top = rankDestinations({ today: "2026-11-05", visitedCities: none, limit: 4 });
    expect(top[0]).toMatchObject({ city: "東京", reason: "銀杏季" });
    expect(top.map((d) => d.city)).toContain("京都");
    expect(top.find((d) => d.city === "京都")?.reason).toBe("紅葉季");
  });

  it("mentions the month when the season is next month", () => {
    const list = rankDestinations({ today: "2026-02-10", visitedCities: none, limit: 20 });
    expect(list.find((d) => d.city === "京都")?.reason).toBe("3 月賞櫻");
  });

  it("sinks places already visited and marks them", () => {
    const list = rankDestinations({ today: "2026-11-05", visitedCities: new Set(["東京"]), limit: 20 });
    const tokyo = list.find((d) => d.city === "東京")!;
    expect(tokyo.visited).toBe(true);
    expect(list.indexOf(tokyo)).toBeGreaterThan(list.findIndex((d) => d.city === "京都"));
  });

  it("lifts short flights before a nearby long weekend", () => {
    // 2026-10-01: 國慶日 (Oct 9-11, 3 days) is 8 days away
    const list = rankDestinations({ today: "2026-10-01", visitedCities: none, limit: 20 });
    const okinawa = list.find((d) => d.city === "沖繩")!;
    const bali = list.find((d) => d.city === "峇里島")!;
    expect(list.indexOf(okinawa)).toBeLessThan(list.indexOf(bali));
    expect(list.find((d) => d.city === "香港")?.reason).toBe("11 月秋冬涼爽");
  });

  it("returns at most the limit", () => {
    expect(rankDestinations({ today: "2026-07-01", visitedCities: none })).toHaveLength(8);
  });
});

describe("nextLongWeekend", () => {
  it("finds the next one within 60 days, with its length", () => {
    expect(nextLongWeekend("2026-10-01")).toEqual({
      start: "2026-10-09",
      end: "2026-10-11",
      name: "國慶日",
      days: 3,
    });
  });

  it("counts a long weekend already underway", () => {
    expect(nextLongWeekend("2026-10-10")?.name).toBe("國慶日");
  });

  it("returns nothing when the next one is too far away", () => {
    expect(nextLongWeekend("2026-07-01")).toBeUndefined();
  });
});

describe("taiwanToday", () => {
  it("is already tomorrow in Taiwan late in the UTC evening", () => {
    expect(taiwanToday(new Date("2026-09-30T17:00:00Z"))).toBe("2026-10-01");
  });
});
