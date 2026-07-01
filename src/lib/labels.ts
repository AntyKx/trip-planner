export const TYPE_LABEL: Record<string, string> = {
  PLACE: "景點",
  RESTAURANT: "餐廳",
  HOTEL: "住宿",
  TRANSPORT: "交通",
  CUSTOM: "自訂",
};

export const MODE_LABEL: Record<string, string> = {
  WALK: "步行",
  TRANSIT: "大眾運輸",
  DRIVE: "開車",
  BIKE: "騎車",
};

export const MODE_ICON: Record<string, string> = {
  WALK: "🚶",
  TRANSIT: "🚆",
  DRIVE: "🚗",
  BIKE: "🚲",
};

export const COUNTRY_FLAG: Record<string, string> = {
  TW: "🇹🇼",
  JP: "🇯🇵",
};

export function formatTime(date: Date | string | null) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(11, 16);
}
