export type ChecklistCategoryValue =
  | "DOCUMENT"
  | "TRANSPORT"
  | "ACCOMMODATION"
  | "MONEY"
  | "INTERNET"
  | "LUGGAGE"
  | "HEALTH"
  | "TICKET"
  | "CUSTOM";

export type ChecklistTemplateEntry = {
  title: string;
  category: ChecklistCategoryValue;
  // Stable key so re-running generateChecklistForTrip never creates a
  // duplicate for the same template entry (enforced by the DB via
  // ChecklistItem's @@unique([tripId, sourceKey])) — not the display
  // title, since that could change wording later without meaning "this is
  // actually a new item."
  sourceKey: string;
};

// Applies to every trip regardless of destination.
export const GENERIC_TEMPLATE: ChecklistTemplateEntry[] = [
  { title: "護照", category: "DOCUMENT", sourceKey: "generic:passport" },
  { title: "機票 / 電子票券", category: "TICKET", sourceKey: "generic:flight-ticket" },
  { title: "住宿訂房確認", category: "ACCOMMODATION", sourceKey: "generic:hotel-confirmation" },
  { title: "旅遊保險", category: "DOCUMENT", sourceKey: "generic:travel-insurance" },
  { title: "緊急聯絡資訊", category: "DOCUMENT", sourceKey: "generic:emergency-contact" },
  { title: "eSIM / SIM 卡", category: "INTERNET", sourceKey: "generic:esim" },
  { title: "行動電源", category: "LUGGAGE", sourceKey: "generic:power-bank" },
  { title: "充電線", category: "LUGGAGE", sourceKey: "generic:charging-cable" },
  { title: "轉接頭", category: "LUGGAGE", sourceKey: "generic:plug-adapter" },
  { title: "信用卡", category: "MONEY", sourceKey: "generic:credit-card" },
  { title: "現金 / 外幣", category: "MONEY", sourceKey: "generic:cash" },
  { title: "常備藥", category: "HEALTH", sourceKey: "generic:medicine" },
  { title: "雨具", category: "LUGGAGE", sourceKey: "generic:rain-gear" },
  { title: "景點門票", category: "TICKET", sourceKey: "generic:attraction-ticket" },
];

// Keyed by the 2-letter country code Place.country actually stores (see
// countryFromAddressComponents in src/lib/places.ts). Unknown/unlisted
// countries just contribute nothing — the generic template still applies.
export const DESTINATION_TEMPLATES: Record<string, ChecklistTemplateEntry[]> = {
  JP: [
    { title: "Visit Japan Web", category: "DOCUMENT", sourceKey: "jp:visit-japan-web" },
    { title: "Suica / PASMO / ICOCA", category: "TRANSPORT", sourceKey: "jp:ic-card" },
    { title: "JR Pass / 地區周遊券", category: "TRANSPORT", sourceKey: "jp:jr-pass" },
    { title: "準備日幣現金", category: "MONEY", sourceKey: "jp:jpy-cash" },
  ],
  KR: [
    { title: "T-money / WOWPASS", category: "TRANSPORT", sourceKey: "kr:t-money" },
    { title: "Naver Map / Kakao Map", category: "INTERNET", sourceKey: "kr:map-app" },
  ],
  TW: [
    { title: "高鐵 / 台鐵票", category: "TRANSPORT", sourceKey: "tw:rail-ticket" },
    { title: "身分證 / 健保卡", category: "DOCUMENT", sourceKey: "tw:id-card" },
  ],
};

// `countries` is whatever's actually present among the trip's Place rows
// right now (see generateChecklistForTrip) — a trip spanning Japan and
// Korea gets both templates' items, not just one.
export function getDestinationTemplates(countries: string[]): ChecklistTemplateEntry[] {
  const seen = new Set<string>();
  const entries: ChecklistTemplateEntry[] = [];
  for (const country of countries) {
    const code = country.trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const template = DESTINATION_TEMPLATES[code];
    if (template) entries.push(...template);
  }
  return entries;
}
