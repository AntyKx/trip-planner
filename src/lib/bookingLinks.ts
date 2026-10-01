// "預訂捷徑" on the home page's next-trip card: outbound search links to
// Google Flights / Agoda / Klook with the trip's destination and dates
// already filled in. No APIs or affiliate programs involved — just search
// URLs, each format checked by actually opening it (2026-10-01):
//   Google Flights takes a natural-language `q` (English city names);
//   Agoda only honours dates together with its own numeric city id, so
//   only cities in this table get a dated hotel search;
//   Klook search takes a free-text query (no dates).

export type BookingCity = {
  name: string; // shown in the UI and used for the Klook query
  en: string; // Google Flights query
  agodaId: number; // from agoda.com/zh-tw/city/<slug>.html
  region: string; // grouping in the picker
  domestic?: boolean; // in Taiwan — flights don't apply
  aliases?: string[]; // other spellings seen in trip titles / addresses
};

export const BOOKING_CITIES: BookingCity[] = [
  { name: "東京", en: "Tokyo", agodaId: 5085, region: "日本" },
  { name: "大阪", en: "Osaka", agodaId: 9590, region: "日本" },
  { name: "京都", en: "Kyoto", agodaId: 1784, region: "日本" },
  { name: "奈良", en: "Nara", agodaId: 13313, region: "日本" },
  { name: "福岡", en: "Fukuoka", agodaId: 16527, region: "日本", aliases: ["博多"] },
  { name: "札幌", en: "Sapporo", agodaId: 3435, region: "日本", aliases: ["北海道"] },
  { name: "沖繩", en: "Okinawa", agodaId: 717899, region: "日本", aliases: ["沖縄", "那霸", "那覇"] },
  { name: "名古屋", en: "Nagoya", agodaId: 13740, region: "日本" },
  { name: "箱根", en: "Hakone", agodaId: 79849, region: "日本" },
  { name: "首爾", en: "Seoul", agodaId: 14690, region: "韓國", aliases: ["首尔"] },
  { name: "釜山", en: "Busan", agodaId: 17172, region: "韓國" },
  { name: "曼谷", en: "Bangkok", agodaId: 9395, region: "東南亞" },
  { name: "清邁", en: "Chiang Mai", agodaId: 7401, region: "東南亞", aliases: ["清迈"] },
  { name: "普吉島", en: "Phuket", agodaId: 16056, region: "東南亞", aliases: ["普吉"] },
  { name: "新加坡", en: "Singapore", agodaId: 4064, region: "東南亞" },
  { name: "吉隆坡", en: "Kuala Lumpur", agodaId: 14524, region: "東南亞" },
  { name: "胡志明市", en: "Ho Chi Minh City", agodaId: 13170, region: "東南亞", aliases: ["胡志明"] },
  { name: "河內", en: "Hanoi", agodaId: 2758, region: "東南亞", aliases: ["河内"] },
  { name: "峴港", en: "Da Nang", agodaId: 16440, region: "東南亞", aliases: ["岘港"] },
  { name: "峇里島", en: "Bali", agodaId: 17193, region: "東南亞", aliases: ["巴里島", "峇里"] },
  { name: "香港", en: "Hong Kong", agodaId: 16808, region: "港澳" },
  { name: "澳門", en: "Macau", agodaId: 21397, region: "港澳", aliases: ["澳门"] },
  { name: "台北", en: "Taipei", agodaId: 4951, region: "台灣", domestic: true, aliases: ["臺北"] },
  { name: "台中", en: "Taichung", agodaId: 12080, region: "台灣", domestic: true, aliases: ["臺中"] },
  { name: "台南", en: "Tainan", agodaId: 18347, region: "台灣", domestic: true, aliases: ["臺南"] },
  { name: "高雄", en: "Kaohsiung", agodaId: 756, region: "台灣", domestic: true },
  { name: "花蓮", en: "Hualien", agodaId: 23127, region: "台灣", domestic: true },
  { name: "宜蘭", en: "Yilan", agodaId: 88773, region: "台灣", domestic: true },
  { name: "紐約", en: "New York", agodaId: 318, region: "歐美" },
  { name: "倫敦", en: "London", agodaId: 233, region: "歐美" },
  { name: "巴黎", en: "Paris", agodaId: 15470, region: "歐美" },
  { name: "巴塞隆納", en: "Barcelona", agodaId: 2002, region: "歐美", aliases: ["巴塞隆拿"] },
  { name: "馬德里", en: "Madrid", agodaId: 5531, region: "歐美" },
];

export const BOOKING_ORIGINS = [
  { name: "台北", en: "Taipei" },
  { name: "台中", en: "Taichung" },
  { name: "高雄", en: "Kaohsiung" },
];

export function findBookingCity(name: string | null | undefined): BookingCity | undefined {
  return BOOKING_CITIES.find((c) => c.name === name);
}

function mentions(text: string, city: BookingCity): boolean {
  return [city.name, ...(city.aliases ?? [])].some((n) => text.includes(n));
}

// The trip's title wins ("首爾五天四夜" is unambiguous); otherwise the city
// named most often across its stops' addresses. Undefined when nothing
// matches — the UI then asks once instead of guessing.
export function detectBookingCity(
  title: string,
  addresses: (string | null | undefined)[]
): BookingCity | undefined {
  const inTitle = BOOKING_CITIES.find((c) => mentions(title, c));
  if (inTitle) return inTitle;

  let best: BookingCity | undefined;
  let bestCount = 0;
  for (const city of BOOKING_CITIES) {
    const count = addresses.filter((a) => a && mentions(a, city)).length;
    if (count > bestCount) {
      best = city;
      bestCount = count;
    }
  }
  return best;
}

// "YYYY-MM-DD" strings, end inclusive (the trip's last day = check-out).
export function nightsBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
}

export function googleFlightsUrl(
  origin: { en: string },
  city: BookingCity,
  start: string,
  end: string
): string {
  const q = `Flights to ${city.en} from ${origin.en} on ${start} through ${end}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=zh-TW&curr=TWD`;
}

export function agodaUrl(city: BookingCity, start: string, nights: number): string {
  const params = new URLSearchParams({
    city: String(city.agodaId),
    checkIn: start,
    los: String(nights),
    rooms: "1",
    adults: "2",
    children: "0",
  });
  return `https://www.agoda.com/zh-tw/search?${params.toString()}`;
}

export function klookUrl(city: BookingCity): string {
  return `https://www.klook.com/zh-TW/search/result/?query=${encodeURIComponent(city.name)}`;
}
