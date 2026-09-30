// Date-only helpers for the trip date-range picker. Everything works on
// "YYYY-MM-DD" strings in UTC — the same way Trip.startDate / TripDay.date
// are stored (see createTrip) — so a date never shifts by a day depending
// on the viewer's timezone.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function toUtcMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

// Inclusive: a same-day trip is 1 day.
export function daySpan(start: string, end: string): number {
  return Math.round((toUtcMs(end) - toUtcMs(start)) / MS_PER_DAY) + 1;
}

export function weekdayOf(date: string): string {
  return WEEKDAYS[new Date(toUtcMs(date)).getUTCDay()];
}

// "10/12 (日)"
export function shortLabel(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} (${weekdayOf(date)})`;
}

export type MonthGrid = {
  key: string; // "2026-10"
  label: string; // "2026 年 10 月"
  // null = leading blank before the 1st, so the 1st lands on its weekday
  cells: (string | null)[];
};

export function monthGrid(year: number, monthIndex: number): MonthGrid {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(Date.UTC(year, monthIndex, d)).toISOString().slice(0, 10));
  }
  const key = first.toISOString().slice(0, 7);
  return { key, label: `${year} 年 ${monthIndex + 1} 月`, cells };
}

// Months from `from` to `to` inclusive, both "YYYY-MM-DD" (only the month
// part matters).
export function monthsBetween(from: string, to: string): MonthGrid[] {
  const months: MonthGrid[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7)) - 1;
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7)) - 1;
  while (y < endY || (y === endY && m <= endM)) {
    months.push(monthGrid(y, m));
    m++;
    if (m === 12) {
      m = 0;
      y++;
    }
  }
  return months;
}

// The flight-search tap rule: the first tap picks the start; the second
// picks the end, unless it's before the start, in which case it becomes
// the new start instead. A third tap starts over. Tapping the start again
// as the second tap makes a one-day trip.
export function nextSelection(
  current: { start: string; end: string },
  tapped: string,
  maxDays: number
): { start: string; end: string } {
  if (!current.start || current.end) return { start: tapped, end: "" };
  if (tapped < current.start) return { start: tapped, end: "" };
  if (daySpan(current.start, tapped) > maxDays) return current;
  return { start: current.start, end: tapped };
}
