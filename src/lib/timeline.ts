import type { TimelineItem } from "@/components/DayTimeline";

export function getNextStop(items: TimelineItem[]): TimelineItem | null {
  const now = Date.now();
  const withTime = items
    .filter((i) => i.startTime)
    .map((i) => ({ item: i, time: new Date(i.startTime as string).getTime() }))
    .sort((a, b) => a.time - b.time);

  const upcoming = withTime.find((x) => x.time >= now);
  if (upcoming) return upcoming.item;
  if (withTime.length > 0) return withTime[withTime.length - 1].item;
  return items[0] ?? null;
}
