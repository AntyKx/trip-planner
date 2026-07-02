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

// google.maps.VehicleType values, for showing transit route alternatives.
export const VEHICLE_LABEL: Record<string, string> = {
  BUS: "公車",
  CABLE_CAR: "纜車",
  COMMUTER_TRAIN: "通勤火車",
  FERRY: "渡輪",
  FUNICULAR: "纜索鐵路",
  GONDOLA_LIFT: "空中纜車",
  HEAVY_RAIL: "鐵路",
  HIGH_SPEED_TRAIN: "高鐵",
  INTERCITY_BUS: "客運",
  METRO_RAIL: "輕軌",
  MONORAIL: "單軌電車",
  RAIL: "火車",
  SHARE_TAXI: "共乘計程車",
  SUBWAY: "捷運",
  TRAM: "輕軌/路面電車",
  TROLLEYBUS: "無軌電車",
  OTHER: "大眾運輸",
};

export const VEHICLE_ICON: Record<string, string> = {
  BUS: "🚌",
  CABLE_CAR: "🚠",
  COMMUTER_TRAIN: "🚆",
  FERRY: "⛴️",
  FUNICULAR: "🚞",
  GONDOLA_LIFT: "🚡",
  HEAVY_RAIL: "🚆",
  HIGH_SPEED_TRAIN: "🚄",
  INTERCITY_BUS: "🚌",
  METRO_RAIL: "🚇",
  MONORAIL: "🚝",
  RAIL: "🚆",
  SHARE_TAXI: "🚕",
  SUBWAY: "🚇",
  TRAM: "🚋",
  TROLLEYBUS: "🚎",
  OTHER: "🚏",
};

export function formatTime(date: Date | string | null) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(11, 16);
}
