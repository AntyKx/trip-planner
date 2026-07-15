import {
  isClosedAllDay,
  isTimeOutsideHours,
  weekdayLabel,
  type OpeningPeriod,
} from "./businessHours";

export type ScheduleItem = {
  id: string;
  type: string; // ItemType
  startTime: string | Date | null;
  endTime: string | Date | null;
  place: { name: string; openHours: string | null } | null;
  note: string | null;
};

export type ScheduleRoute = {
  fromItemId: string;
  toItemId: string;
  durationMin: number | null;
};

export type ScheduleProposal = {
  itemId: string;
  name: string;
  oldStart: string | null; // "HH:mm"
  oldEnd: string | null;
  newStart: string; // "HH:mm"
  newEnd: string;
  // TRANSPORT items that already carry a start time are externally
  // scheduled (flights, trains) — the scheduler flows around them instead
  // of moving them, and apply skips writing them entirely.
  fixed: boolean;
  warning: string | null;
};

// Default visit durations (minutes) by item type — deliberately simple
// v1 heuristics; PlaceInsight.suggestedDuration isn't loaded on the trip
// page and is a free-form string, so type defaults keep this pure and
// predictable. Tunable in one place.
const DEFAULT_DURATION_MIN: Record<string, number> = {
  PLACE: 90,
  RESTAURANT: 75,
  HOTEL: 60,
  TRANSPORT: 30,
  CUSTOM: 30,
};

// Used between consecutive items when no Route row exists yet (routes are
// computed client-side lazily — see DayTimeline's auto-fill effect — so
// gaps are normal, not an error).
const FALLBACK_TRANSIT_MIN = 10;

const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

function toHHMM(value: string | Date | null): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(11, 16);
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHHMM(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, LAST_MINUTE_OF_DAY));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parsePeriods(openHours: string | null | undefined): OpeningPeriod[] | null {
  if (!openHours) return null;
  try {
    return JSON.parse(openHours);
  } catch {
    return null;
  }
}

// Earliest opening minute on `date`'s weekday, or null when there's no
// period that starts on that weekday (closed, or only spillover coverage
// from the previous day — good enough for "wait until it opens").
function earliestOpenMinutes(periods: OpeningPeriod[], date: Date): number | null {
  const day = date.getDay();
  const todays = periods.filter((p) => p.day === day);
  if (todays.length === 0) return null;
  return Math.min(...todays.map((p) => p.openMinutes));
}

function displayName(item: ScheduleItem): string {
  if (item.place) return item.place.name;
  const note = item.note?.trim();
  return note ? note.slice(0, 20) : "自訂項目";
}

function durationFor(item: ScheduleItem): number {
  return DEFAULT_DURATION_MIN[item.type] ?? DEFAULT_DURATION_MIN.CUSTOM;
}

// Walks the day's items in timeline order with a single forward-moving
// cursor, assigning arrival/departure times: cursor + transit → arrival
// (pushed later if the place hasn't opened yet), arrival + type-default
// stay → departure. Pure and synchronous so the preview modal can just
// recompute on every start-time change.
export function buildDaySchedule(
  items: ScheduleItem[],
  routes: ScheduleRoute[],
  date: string,
  dayStartHHMM: string
): ScheduleProposal[] {
  const proposals: ScheduleProposal[] = [];
  const dateObj = new Date(`${date}T00:00:00`);
  let cursor = hhmmToMinutes(dayStartHHMM);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const oldStart = toHHMM(item.startTime);
    const oldEnd = toHHMM(item.endTime);
    const warnings: string[] = [];

    const fixedStart = item.type === "TRANSPORT" && oldStart ? oldStart : null;
    if (fixedStart) {
      const startMin = hhmmToMinutes(fixedStart);
      if (cursor > startMin) {
        warnings.push("前面的行程可能來不及銜接這班交通");
      }
      const endMin = oldEnd
        ? hhmmToMinutes(oldEnd)
        : startMin + durationFor(item);
      cursor = Math.max(cursor, endMin);
      proposals.push({
        itemId: item.id,
        name: displayName(item),
        oldStart,
        oldEnd,
        newStart: fixedStart,
        newEnd: oldEnd ?? minutesToHHMM(endMin),
        fixed: true,
        warning: warnings[0] ?? null,
      });
      continue;
    }

    // Transit from the previous item — a Route row if one exists, a small
    // flat buffer otherwise.
    if (i > 0) {
      const prev = items[i - 1];
      const route = routes.find(
        (r) => r.fromItemId === prev.id && r.toItemId === item.id
      );
      cursor += route?.durationMin ?? FALLBACK_TRANSIT_MIN;
    }

    const periods = parsePeriods(item.place?.openHours);
    if (periods && periods.length > 0) {
      if (isClosedAllDay(periods, dateObj)) {
        warnings.push(`${weekdayLabel(dateObj)}公休`);
      } else {
        const opensAt = earliestOpenMinutes(periods, dateObj);
        if (opensAt != null && cursor < opensAt) {
          cursor = opensAt; // wait for opening
        }
      }
    }

    if (cursor >= LAST_MINUTE_OF_DAY) {
      warnings.push("已超過午夜，這天可能排不下");
    }

    const start = Math.min(cursor, LAST_MINUTE_OF_DAY);
    const end = Math.min(start + durationFor(item), LAST_MINUTE_OF_DAY);

    if (
      periods &&
      periods.length > 0 &&
      !isClosedAllDay(periods, dateObj) &&
      isTimeOutsideHours(periods, dateObj, minutesToHHMM(end))
    ) {
      warnings.push("停留到打烊之後，可能得提早離開");
    }

    proposals.push({
      itemId: item.id,
      name: displayName(item),
      oldStart,
      oldEnd,
      newStart: minutesToHHMM(start),
      newEnd: minutesToHHMM(end),
      fixed: false,
      warning: warnings[0] ?? null,
    });

    cursor = end;
  }

  return proposals;
}
