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
  Plane,
  FileText,
  Wallet,
  Wifi,
  Luggage,
  Pill,
  Ticket,
} from "lucide-react";
import type { ChecklistCategoryValue } from "./checklistTemplates";

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
  CUSTOM: { bg: "bg-paper-alt", text: "text-ink-700", hex: "#64748b" },
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
  FLY: "搭飛機",
};

export const MODE_ICON: Record<string, LucideIcon> = {
  WALK: Footprints,
  TRANSIT: TrainFront,
  DRIVE: Car,
  BIKE: Bike,
  FLY: Plane,
};

export const CHECKLIST_CATEGORY_LABEL: Record<ChecklistCategoryValue, string> = {
  DOCUMENT: "文件 / 證件",
  TRANSPORT: "交通",
  ACCOMMODATION: "住宿",
  MONEY: "金錢 / 支付",
  INTERNET: "網路 / 通訊",
  LUGGAGE: "行李",
  HEALTH: "健康 / 藥品",
  TICKET: "票券",
  CUSTOM: "自訂",
};

export const CHECKLIST_CATEGORY_ICON: Record<ChecklistCategoryValue, LucideIcon> = {
  DOCUMENT: FileText,
  TRANSPORT: TrainFront,
  ACCOMMODATION: Bed,
  MONEY: Wallet,
  INTERNET: Wifi,
  LUGGAGE: Luggage,
  HEALTH: Pill,
  TICKET: Ticket,
  CUSTOM: StickyNote,
};

export const CHECKLIST_CATEGORY_COLOR: Record<
  ChecklistCategoryValue,
  { bg: string; text: string }
> = {
  DOCUMENT: { bg: "bg-indigo-50", text: "text-indigo-600" },
  TRANSPORT: { bg: "bg-sky-50", text: "text-sky-600" },
  ACCOMMODATION: { bg: "bg-violet-50", text: "text-violet-600" },
  MONEY: { bg: "bg-amber-50", text: "text-amber-700" },
  INTERNET: { bg: "bg-cyan-50", text: "text-cyan-600" },
  LUGGAGE: { bg: "bg-orange-50", text: "text-orange-600" },
  HEALTH: { bg: "bg-rose-50", text: "text-rose-600" },
  TICKET: { bg: "bg-brand-50", text: "text-brand-600" },
  CUSTOM: { bg: "bg-paper-alt", text: "text-ink-700" },
};

// Display order for the category-grouped checklist view — enum
// declaration order doesn't necessarily match the most useful reading
// order (e.g. CUSTOM belongs last, as a catch-all).
export const CHECKLIST_CATEGORY_ORDER: ChecklistCategoryValue[] = [
  "DOCUMENT",
  "TRANSPORT",
  "ACCOMMODATION",
  "MONEY",
  "INTERNET",
  "LUGGAGE",
  "HEALTH",
  "TICKET",
  "CUSTOM",
];

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

// Timeline item card's "停留時間" — only shown when both ends are known;
// a single missing endTime is common (not every stop has one) and isn't
// worth guessing at.
export function formatStayDuration(
  start: Date | string | null,
  end: Date | string | null
): string | null {
  if (!start || !end) return null;
  const startMs = (typeof start === "string" ? new Date(start) : start).getTime();
  const endMs = (typeof end === "string" ? new Date(end) : end).getTime();
  const diffMin = Math.round((endMs - startMs) / 60000);
  if (diffMin <= 0) return null;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h === 0) return `停留 ${m} 分鐘`;
  if (m === 0) return `停留 ${h} 小時`;
  return `停留 ${h} 小時 ${m} 分鐘`;
}

// "最後更新" on the home page's trip cards — coarse buckets are
// deliberate (a travel-planning app doesn't need minute-level precision,
// and coarser buckets don't need to be re-rendered every minute to stay
// accurate the way "3 分鐘前" would).
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / (60 * 1000));
  if (diffMin < 1) return "剛剛";
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小時前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} 個月前`;
  return `${Math.floor(diffMonth / 12)} 年前`;
}
