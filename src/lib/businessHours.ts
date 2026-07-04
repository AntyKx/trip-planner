// Raw shape from Google Places API (New) — Place.OpeningHours.periods.
// `close` is absent entirely for a business that's open 24 hours starting
// at that period's `open` point.
export type RawPeriodPoint = { day: number; hour: number; minute: number };
export type RawPeriod = { open: RawPeriodPoint; close?: RawPeriodPoint };

// Normalized: one entry per period, in minutes-since-midnight of `day`
// (0 = Sunday ... 6 = Saturday). `closeMinutes` can exceed 1440 when the
// period spans past midnight (e.g. open Fri 18:00, close Sat 02:00 ->
// day: 5, openMinutes: 1080, closeMinutes: 1560). `closeMinutes: null`
// means the business is open with no closing time in this stretch (a
// 24-hour place has a single period like this covering day 0).
export type OpeningPeriod = {
  day: number;
  openMinutes: number;
  closeMinutes: number | null;
};

export function parseOpeningPeriods(raw: RawPeriod[] | undefined): OpeningPeriod[] {
  if (!raw) return [];
  return raw.map((p) => {
    const openMinutes = p.open.hour * 60 + p.open.minute;
    if (!p.close) return { day: p.open.day, openMinutes, closeMinutes: null };

    let closeMinutes = p.close.hour * 60 + p.close.minute;
    const dayDiff = (p.close.day - p.open.day + 7) % 7;
    closeMinutes += dayDiff * 1440;
    // Google represents a period ending at midnight of the same day as
    // close.hour/minute = 0 with close.day = open.day; that's actually
    // "runs to the end of the day," i.e. the next midnight.
    if (closeMinutes <= openMinutes) closeMinutes += 1440;
    return { day: p.open.day, openMinutes, closeMinutes };
  });
}

// True if the business has zero open hours anywhere on `date`'s weekday
// (including a period from the previous day spilling past midnight into
// it). Used for the "this day might be closed" warning when adding a
// place — we only want to flag a full closure, not partial hours, since
// the exact visit time isn't known yet at add-time.
export function isClosedAllDay(periods: OpeningPeriod[], date: Date): boolean {
  if (periods.length === 0) return false; // no hours data — nothing to check
  if (periods.some((p) => p.closeMinutes === null)) return false; // 24/7

  const day = date.getDay();
  const prevDay = (day + 6) % 7;
  return !periods.some(
    (p) =>
      p.day === day ||
      (p.day === prevDay && p.closeMinutes !== null && p.closeMinutes > 1440)
  );
}

// True if the given "HH:mm" time on `date` falls outside every period
// that covers it — e.g. entering 21:00 when the place closes at 20:00, or
// 08:00 when it opens at 10:00. Used for the start/end time warning on
// timeline item cards.
export function isTimeOutsideHours(
  periods: OpeningPeriod[],
  date: Date,
  hhmm: string
): boolean {
  if (periods.length === 0) return false;
  if (periods.some((p) => p.closeMinutes === null)) return false;

  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const minutes = h * 60 + m;

  const day = date.getDay();
  const prevDay = (day + 6) % 7;
  const covered = periods.some((p) => {
    if (p.day === day && minutes >= p.openMinutes && minutes <= p.closeMinutes!) {
      return true;
    }
    if (p.day === prevDay && p.closeMinutes !== null && p.closeMinutes > 1440) {
      // this period's coverage spills from the previous day's midnight
      // through to closeMinutes - 1440 on `date`.
      if (minutes <= p.closeMinutes - 1440) return true;
    }
    return false;
  });
  return !covered;
}

const WEEKDAY_LABEL = ["日", "一", "二", "三", "四", "五", "六"];

export function weekdayLabel(date: Date): string {
  return `週${WEEKDAY_LABEL[date.getDay()]}`;
}
