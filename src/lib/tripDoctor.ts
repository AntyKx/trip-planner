import { isClosedAllDay, isTimeOutsideHours, weekdayLabel, type OpeningPeriod } from "./businessHours";
import { getWeatherReminders, type DailyWeather } from "./weather";

export type DoctorItem = {
  id: string;
  startTime: string | Date | null;
  endTime: string | Date | null;
  place: { name: string; openHours: string | null } | null;
};

export type DoctorRoute = {
  fromItemId: string;
  toItemId: string;
  durationMin: number | null;
};

export type DoctorDay = {
  id: string;
  dayIndex: number;
  date: string; // "YYYY-MM-DD"
  weather: DailyWeather | null;
  // Timeline order (same order the day's cards render in), not sortOrder
  // itself — callers already have items pre-sorted for display.
  items: DoctorItem[];
  routes: DoctorRoute[];
};

export type DoctorFinding = {
  dayId: string;
  dayIndex: number;
  severity: "issue" | "notice";
  message: string;
};

// A day with more real stops than this gets a soft "you might be
// overpacking" notice — not a hard rule, just a heuristic worth surfacing.
// Kept as a constant so it's easy to tune later.
const BUSY_DAY_THRESHOLD = 6;

function toHHMM(value: string | Date | null): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(11, 16);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function parsePeriods(openHours: string | null): OpeningPeriod[] | null {
  if (!openHours) return null;
  try {
    return JSON.parse(openHours);
  } catch {
    return null;
  }
}

function checkBusinessHours(day: DoctorDay): DoctorFinding[] {
  const findings: DoctorFinding[] = [];
  const dateObj = new Date(`${day.date}T00:00:00`);

  for (const item of day.items) {
    const periods = parsePeriods(item.place?.openHours ?? null);
    if (!item.place || !periods) continue;

    if (isClosedAllDay(periods, dateObj)) {
      findings.push({
        dayId: day.id,
        dayIndex: day.dayIndex,
        severity: "issue",
        message: `${item.place.name} 在${weekdayLabel(dateObj)}公休，行程排在這天`,
      });
      continue;
    }

    const startHHMM = toHHMM(item.startTime);
    if (startHHMM && isTimeOutsideHours(periods, dateObj, startHHMM)) {
      findings.push({
        dayId: day.id,
        dayIndex: day.dayIndex,
        severity: "issue",
        message: `${item.place.name} 排在 ${startHHMM}，可能還沒開門或已經打烊`,
      });
    }
  }

  return findings;
}

function checkTransitGaps(day: DoctorDay): DoctorFinding[] {
  const findings: DoctorFinding[] = [];

  for (let i = 0; i < day.items.length - 1; i++) {
    const a = day.items[i];
    const b = day.items[i + 1];

    const leaveHHMM = toHHMM(a.endTime ?? a.startTime);
    const arriveHHMM = toHHMM(b.startTime);
    if (!leaveHHMM || !arriveHHMM) continue;

    const gap = toMinutes(arriveHHMM) - toMinutes(leaveHHMM);
    const fromName = a.place?.name ?? "上一個項目";
    const toName = b.place?.name ?? "下一個項目";

    if (gap < 0) {
      findings.push({
        dayId: day.id,
        dayIndex: day.dayIndex,
        severity: "issue",
        message: `${fromName} 跟 ${toName} 的時間重疊了`,
      });
      continue;
    }

    // Without a computed route, there's nothing to compare the gap against
    // — skip rather than guess (Route rows aren't guaranteed to exist yet,
    // see DayTimeline's client-side auto-fill).
    const route = day.routes.find((r) => r.fromItemId === a.id && r.toItemId === b.id);
    if (route?.durationMin == null) continue;

    if (gap < route.durationMin) {
      findings.push({
        dayId: day.id,
        dayIndex: day.dayIndex,
        severity: "issue",
        message: `${fromName} → ${toName} 交通約需 ${route.durationMin} 分鐘，但只排了 ${gap} 分鐘`,
      });
    }
  }

  return findings;
}

function checkBusyDay(day: DoctorDay): DoctorFinding[] {
  const placeCount = day.items.filter((i) => i.place).length;
  if (placeCount <= BUSY_DAY_THRESHOLD) return [];

  return [
    {
      dayId: day.id,
      dayIndex: day.dayIndex,
      severity: "notice",
      message: `這天排了 ${placeCount} 個地點，行程可能會很趕，建議抓重點`,
    },
  ];
}

function checkWeather(day: DoctorDay): DoctorFinding[] {
  if (!day.weather) return [];
  return getWeatherReminders(day.weather).map((message) => ({
    dayId: day.id,
    dayIndex: day.dayIndex,
    severity: "notice" as const,
    message,
  }));
}

// Pure, synchronous, no network/AI calls — every input is already loaded
// client-side (see TripDayBoard's daysWithWeather), so this can run on
// every render without any cost or loading state.
export function runTripDoctor(days: DoctorDay[]): DoctorFinding[] {
  return days.flatMap((day) => [
    ...checkBusinessHours(day),
    ...checkTransitGaps(day),
    ...checkBusyDay(day),
    ...checkWeather(day),
  ]);
}
