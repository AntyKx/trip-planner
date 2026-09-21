// Rule-based Instagram caption builder for the 旅遊書 — no AI, just the
// stop name + journal text + a few auto hashtags, ready to paste.
import { TYPE_LABEL } from "./labels";
import type { JournalBookDay, JournalBookItem, JournalBookTrip } from "@/components/JournalBook";

// Instagram's caption cap is 2200 characters and 30 hashtags.
export const IG_MAX_CAPTION = 2200;
const IG_MAX_HASHTAGS = 30;

// Hashtags can't contain spaces or punctuation; keep letters/digits/CJK.
export function toHashtag(text: string): string | null {
  const cleaned = text.replace(/[^\p{L}\p{N}]/gu, "");
  return cleaned ? `#${cleaned}` : null;
}

function uniqueHashtags(texts: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const text of texts) {
    const tag = toHashtag(text);
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      tags.push(tag);
    }
  }
  return tags.slice(0, IG_MAX_HASHTAGS);
}

function itemName(item: JournalBookItem): string {
  return item.place?.name ?? item.note ?? TYPE_LABEL[item.type] ?? "回憶";
}

export function buildItemCaption(item: JournalBookItem, tripTitle: string): string {
  const name = itemName(item);
  const parts = [item.place ? `📍 ${name}` : name];
  if (item.journalText?.trim()) parts.push(item.journalText.trim());
  const tags = uniqueHashtags([item.place?.name ?? "", tripTitle, "旅行", "旅遊書"]);
  return truncateCaption(parts.join("\n\n"), tags.join(" "));
}

export function buildDayCaption(day: JournalBookDay, tripTitle: string): string {
  const lines: string[] = [];
  const placeNames: string[] = [];
  for (const item of day.items) {
    const text = item.journalText?.trim();
    if (!text) continue;
    lines.push(`${item.place ? "📍 " : ""}${itemName(item)}\n${text}`);
    if (item.place) placeNames.push(item.place.name);
  }
  const body = [`✈️ ${tripTitle} Day ${day.dayIndex}`, ...lines].join("\n\n");
  const tags = uniqueHashtags([tripTitle, ...placeNames, "旅行", "旅遊書"]).join(" ");
  return truncateCaption(body, tags);
}

export function buildTripCaption(trip: JournalBookTrip): string {
  const sections: string[] = [`✈️ ${trip.title}`];
  const placeNames: string[] = [];
  for (const day of trip.days) {
    const lines: string[] = [];
    for (const item of day.items) {
      const text = item.journalText?.trim();
      if (!text) continue;
      lines.push(`${item.place ? "📍 " : ""}${itemName(item)}\n${text}`);
      if (item.place) placeNames.push(item.place.name);
    }
    if (lines.length > 0) sections.push(`— Day ${day.dayIndex} —\n${lines.join("\n\n")}`);
  }
  const tags = uniqueHashtags([trip.title, ...placeNames, "旅行", "旅遊書"]).join(" ");
  return truncateCaption(sections.join("\n\n"), tags);
}

// Cuts the body (never the hashtags) so the whole caption fits IG's cap.
function truncateCaption(body: string, tags = ""): string {
  const tail = tags ? `\n\n${tags}` : "";
  const room = IG_MAX_CAPTION - tail.length;
  if (body.length <= room) return body + tail;
  return body.slice(0, Math.max(0, room - 1)).trimEnd() + "…" + tail;
}
