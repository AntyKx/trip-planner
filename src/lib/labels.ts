import type { LucideIcon } from "lucide-react";
import {
  MapPin,
  UtensilsCrossed,
  Bed,
  TrainFront,
  TrainFrontTunnel,
  StickyNote,
  Coffee,
  ShoppingBag,
  Sparkles,
  Footprints,
  Car,
  Bike,
  Bus,
  CableCar,
  Ship,
  CarTaxiFront,
  TramFront,
  Route,
} from "lucide-react";

export const TYPE_LABEL: Record<string, string> = {
  PLACE: "景點",
  RESTAURANT: "餐廳",
  HOTEL: "住宿",
  TRANSPORT: "交通",
  CUSTOM: "自訂",
};

// Icon shown per ItemType — the authoritative, always-correct mapping.
export const TYPE_ICON: Record<string, LucideIcon> = {
  PLACE: MapPin,
  RESTAURANT: UtensilsCrossed,
  HOTEL: Bed,
  TRANSPORT: TrainFront,
  CUSTOM: StickyNote,
};

// Drives both the timeline card accent and the map marker color, so the two
// stay visually consistent by construction instead of duplicated logic.
export const TYPE_COLOR: Record<string, { bg: string; text: string; hex: string }> = {
  PLACE: { bg: "bg-brand-50", text: "text-brand-600", hex: "#2b6094" },
  RESTAURANT: { bg: "bg-accent-50", text: "text-accent-600", hex: "#b45309" },
  HOTEL: { bg: "bg-violet-50", text: "text-violet-600", hex: "#7c3aed" },
  TRANSPORT: { bg: "bg-sky-50", text: "text-sky-600", hex: "#0284c7" },
  CUSTOM: { bg: "bg-slate-100", text: "text-slate-600", hex: "#64748b" },
};

// Place.category is a free-text, localized display name from the provider
// (Google/Hotpepper) — not a stable enum key. This only picks a nicer glyph
// within the same ItemType; it never overrides TYPE_LABEL/TYPE_ICON's
// authoritative type judgement, since the source text is unreliable.
const CATEGORY_ICON_OVERRIDES: { keywords: string[]; icon: LucideIcon }[] = [
  { keywords: ["咖啡", "cafe", "coffee"], icon: Coffee },
  { keywords: ["購物", "商店", "百貨", "市場", "mall", "shop", "store"], icon: ShoppingBag },
  {
    keywords: ["博物館", "樂園", "美術館", "體驗", "活動", "museum", "park", "activity", "gallery"],
    icon: Sparkles,
  },
];

export function refineIconFromCategory(
  type: string,
  categoryText: string | null | undefined
): LucideIcon {
  const base = TYPE_ICON[type] ?? MapPin;
  if (!categoryText) return base;
  const lower = categoryText.toLowerCase();
  for (const { keywords, icon } of CATEGORY_ICON_OVERRIDES) {
    if (keywords.some((k) => lower.includes(k.toLowerCase()))) {
      return icon;
    }
  }
  return base;
}

export const MODE_LABEL: Record<string, string> = {
  WALK: "步行",
  TRANSIT: "大眾運輸",
  DRIVE: "開車",
  BIKE: "騎車",
};

export const MODE_ICON: Record<string, LucideIcon> = {
  WALK: Footprints,
  TRANSIT: TrainFront,
  DRIVE: Car,
  BIKE: Bike,
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

export const VEHICLE_ICON: Record<string, LucideIcon> = {
  BUS: Bus,
  CABLE_CAR: CableCar,
  COMMUTER_TRAIN: TrainFront,
  FERRY: Ship,
  FUNICULAR: CableCar,
  GONDOLA_LIFT: CableCar,
  HEAVY_RAIL: TrainFront,
  HIGH_SPEED_TRAIN: TrainFront,
  INTERCITY_BUS: Bus,
  METRO_RAIL: TrainFrontTunnel,
  MONORAIL: TrainFront,
  RAIL: TrainFront,
  SHARE_TAXI: CarTaxiFront,
  SUBWAY: TrainFrontTunnel,
  TRAM: TramFront,
  TROLLEYBUS: Bus,
  OTHER: Route,
};

export function formatTime(date: Date | string | null) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(11, 16);
}
