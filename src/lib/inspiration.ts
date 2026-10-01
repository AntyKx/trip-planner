// 目的地靈感 on the home page — a fixed, hand-picked list re-ordered by
// plain rules (no AI, nothing personalised beyond the user's own trips):
//   1. season: destinations whose best months include this month, then
//      next month, rise to the top with the reason shown ("紅葉季")
//   2. a Taiwan long weekend within the next 60 days lifts short flights
//   3. places already visited (from finished trips) sink and say 去過
// The season notes are general travel knowledge written in by hand, not
// live data.

export type Destination = {
  city: string; // shown on the chip
  country: string;
  // Same picker as the explore page (JP/TW get hard bounds, OTHER is
  // appended as free text — see InspirationChips' link).
  region: "JP" | "TW" | "OTHER";
  // Matches BOOKING_CITIES names, so visited trips can be recognised with
  // detectBookingCity.
  matchName: string;
  flightHours: number; // from Taipei, rough; 0 = domestic
  seasons: Partial<Record<number, string>>; // month (1-12) -> why
};

export const DESTINATIONS: Destination[] = [
  { city: "東京", country: "日本", region: "JP", matchName: "東京", flightHours: 3, seasons: { 3: "賞櫻", 4: "賞櫻", 11: "銀杏季", 12: "冬季燈飾" } },
  { city: "京都", country: "日本", region: "JP", matchName: "京都", flightHours: 2.5, seasons: { 3: "賞櫻", 4: "賞櫻", 11: "紅葉季" } },
  { city: "大阪", country: "日本", region: "JP", matchName: "大阪", flightHours: 2.5, seasons: { 3: "賞櫻", 4: "賞櫻", 11: "紅葉季", 12: "冬季燈飾" } },
  { city: "福岡", country: "日本", region: "JP", matchName: "福岡", flightHours: 2, seasons: { 3: "賞櫻", 4: "賞櫻", 11: "紅葉季" } },
  { city: "北海道", country: "日本", region: "JP", matchName: "札幌", flightHours: 4, seasons: { 1: "雪景", 2: "雪祭", 7: "薰衣草季", 8: "避暑", 12: "雪景" } },
  { city: "沖繩", country: "日本", region: "JP", matchName: "沖繩", flightHours: 1.5, seasons: { 4: "海島好天氣", 5: "海島好天氣", 6: "海島好天氣", 10: "秋季海島" } },
  { city: "首爾", country: "韓國", region: "OTHER", matchName: "首爾", flightHours: 2.5, seasons: { 4: "賞櫻", 10: "秋楓季", 11: "秋楓季", 12: "冬季雪景", 1: "冬季雪景" } },
  { city: "釜山", country: "韓國", region: "OTHER", matchName: "釜山", flightHours: 2.5, seasons: { 4: "賞櫻", 7: "海灘季", 8: "海灘季", 10: "秋楓季", 11: "秋楓季" } },
  { city: "香港", country: "香港", region: "OTHER", matchName: "香港", flightHours: 1.5, seasons: { 11: "秋冬涼爽", 12: "秋冬涼爽", 1: "秋冬涼爽" } },
  { city: "曼谷", country: "泰國", region: "OTHER", matchName: "曼谷", flightHours: 4, seasons: { 11: "乾季涼爽", 12: "乾季涼爽", 1: "乾季涼爽", 2: "乾季涼爽" } },
  { city: "清邁", country: "泰國", region: "OTHER", matchName: "清邁", flightHours: 4, seasons: { 11: "乾季涼爽", 12: "乾季涼爽", 1: "乾季涼爽" } },
  { city: "峴港", country: "越南", region: "OTHER", matchName: "峴港", flightHours: 3, seasons: { 3: "乾季海灘", 4: "乾季海灘", 5: "乾季海灘", 6: "乾季海灘", 7: "乾季海灘", 8: "乾季海灘" } },
  { city: "峇里島", country: "印尼", region: "OTHER", matchName: "峇里島", flightHours: 5, seasons: { 5: "乾季", 6: "乾季", 7: "乾季", 8: "乾季", 9: "乾季" } },
  { city: "台南", country: "台灣", region: "TW", matchName: "台南", flightHours: 0, seasons: { 11: "涼爽好逛", 12: "涼爽好逛", 1: "涼爽好逛", 2: "涼爽好逛", 3: "涼爽好逛" } },
  { city: "花蓮", country: "台灣", region: "TW", matchName: "花蓮", flightHours: 0, seasons: { 4: "好天氣", 5: "好天氣", 9: "好天氣", 10: "好天氣" } },
];

// Taiwan long weekends (3+ consecutive days off around a national
// holiday), derived from the government office calendar published by
// 行政院人事行政總處, via github.com/ruyut/TaiwanCalendar (2026-10-01).
// Add the next year once it's published.
export const LONG_WEEKENDS: { start: string; end: string; name: string }[] = [
  { start: "2026-02-14", end: "2026-02-22", name: "春節" },
  { start: "2026-02-27", end: "2026-03-01", name: "和平紀念日" },
  { start: "2026-04-03", end: "2026-04-06", name: "清明連假" },
  { start: "2026-05-01", end: "2026-05-03", name: "勞動節" },
  { start: "2026-06-19", end: "2026-06-21", name: "端午節" },
  { start: "2026-09-25", end: "2026-09-28", name: "中秋節" },
  { start: "2026-10-09", end: "2026-10-11", name: "國慶日" },
  { start: "2026-10-24", end: "2026-10-26", name: "光復節" },
  { start: "2026-12-25", end: "2026-12-27", name: "行憲紀念日" },
  { start: "2027-01-01", end: "2027-01-03", name: "元旦" },
  { start: "2027-02-04", end: "2027-02-10", name: "春節" },
  { start: "2027-02-27", end: "2027-03-01", name: "和平紀念日" },
  { start: "2027-04-03", end: "2027-04-06", name: "清明連假" },
  { start: "2027-04-30", end: "2027-05-02", name: "勞動節" },
  { start: "2027-10-09", end: "2027-10-11", name: "國慶日" },
  { start: "2027-10-23", end: "2027-10-25", name: "光復節" },
  { start: "2027-12-24", end: "2027-12-26", name: "行憲紀念日" },
];

const LONG_WEEKEND_LOOKAHEAD_DAYS = 60;
// A long weekend lifts destinations within this many hours' flight —
// anything further doesn't fit 3-4 days.
const SHORT_FLIGHT_HOURS = 3;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function nextLongWeekend(today: string) {
  const next = LONG_WEEKENDS.find((w) => w.end >= today);
  if (!next || daysBetween(today, next.start) > LONG_WEEKEND_LOOKAHEAD_DAYS) return undefined;
  return { ...next, days: daysBetween(next.start, next.end) + 1 };
}

export type RankedDestination = Destination & {
  reason?: string;
  visited: boolean;
};

export function rankDestinations({
  today,
  visitedCities,
  limit = 8,
}: {
  today: string; // "YYYY-MM-DD" in Taiwan time
  visitedCities: Set<string>; // BOOKING_CITIES names from finished trips
  limit?: number;
}): RankedDestination[] {
  const month = Number(today.slice(5, 7));
  const nextMonth = (month % 12) + 1;
  const weekend = nextLongWeekend(today);

  return DESTINATIONS.map((d, index) => {
    let score = 0;
    let reason: string | undefined;
    if (d.seasons[month]) {
      score += 3;
      reason = d.seasons[month];
    } else if (d.seasons[nextMonth]) {
      score += 2;
      reason = `${nextMonth} 月${d.seasons[nextMonth]}`;
    }
    // Only short trips fit a 3-4 day long weekend; Lunar New Year (7+
    // days) fits anything, so it doesn't reorder.
    if (weekend && weekend.days <= 5 && d.flightHours <= SHORT_FLIGHT_HOURS) {
      score += 1;
      reason ??= d.flightHours === 0 ? `${weekend.name}連假` : `連假近・飛 ${d.flightHours} 小時`;
    }
    const visited = visitedCities.has(d.matchName);
    if (visited) score -= 2;
    // index as a stable tie-breaker keeps the hand-picked order.
    return { ...d, reason, visited, score, index };
  })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((d) => ({
      city: d.city,
      country: d.country,
      region: d.region,
      matchName: d.matchName,
      flightHours: d.flightHours,
      seasons: d.seasons,
      reason: d.reason,
      visited: d.visited,
    }));
}

// "Today" in Taiwan regardless of the server's timezone (Vercel runs UTC).
export function taiwanToday(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
