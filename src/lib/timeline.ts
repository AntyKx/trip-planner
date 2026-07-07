import type { TimelineItem } from "@/components/DayTimeline";

// Item times are stored as literal wall-clock times pretending to be UTC
// (14:00 in Taipei is saved as "...T14:00:00Z" — see EditItemModal's toIso
// and the timezone bug fix that established this convention), so "now" has
// to be encoded the same way before the two can be compared: the viewer's
// local wall clock read out as if it were UTC. Comparing against the real
// epoch (plain Date.now()) was off by the viewer's whole UTC offset — in
// Taiwan (+8) a stop kept showing as "下一站" for 8 hours after it had
// already passed.
function wallClockNowMs(): number {
  const now = new Date();
  return Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
  );
}

export function getNextStop(
  items: TimelineItem[],
  // Injectable for tests; production callers use the wall-clock default.
  nowMs: number = wallClockNowMs()
): TimelineItem | null {
  const withTime = items
    .filter((i) => i.startTime)
    .map((i) => ({ item: i, time: new Date(i.startTime as string).getTime() }))
    .sort((a, b) => a.time - b.time);

  const upcoming = withTime.find((x) => x.time >= nowMs);
  if (upcoming) return upcoming.item;
  if (withTime.length > 0) return withTime[withTime.length - 1].item;
  return items[0] ?? null;
}
