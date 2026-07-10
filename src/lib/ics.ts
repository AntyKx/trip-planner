import { TYPE_LABEL } from "@/lib/labels";

export interface IcsItemInput {
  id: string;
  type: string; // ItemType
  placeName: string | null;
  placeAddress: string | null;
  note: string | null;
  confirmationNumber: string | null;
  startTime: Date | string | null;
  endTime: Date | string | null;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// RFC 5545 recommends folding lines at 75 octets; most modern calendar apps
// tolerate unfolded lines, but folding costs nothing and keeps stricter
// parsers (some corporate Outlook/Exchange setups) happy.
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

// Item times are stored as wall-clock values pretending to be UTC (see
// src/lib/timeline.ts) — reading the UTC getters back out gives the actual
// intended local time at the destination. Emitted here as a "floating"
// ics time (no Z, no TZID): the closest available approximation without
// modeling a real IANA timezone per destination, and consistent with how
// the rest of the app already treats these values as plain wall-clock, not
// real UTC instants.
function toFloatingIcsTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  );
}

function toUtcIcsTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

export function buildTripIcs(tripTitle: string, items: IcsItemInput[]): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trip Planner//trip-planner//ZH-TW",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(tripTitle)}`,
  ];

  for (const item of items) {
    if (!item.startTime) continue;
    const start = new Date(item.startTime);
    const end = item.endTime ? new Date(item.endTime) : null;

    const summary = item.placeName ?? TYPE_LABEL[item.type] ?? "行程項目";
    const descriptionParts = [
      item.confirmationNumber ? `確認碼／訂位代號：${item.confirmationNumber}` : null,
      item.note,
    ].filter((part): part is string => !!part);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${item.id}@trip-planner`);
    lines.push(`DTSTAMP:${toUtcIcsTime(now)}`);
    lines.push(`DTSTART:${toFloatingIcsTime(start)}`);
    if (end) lines.push(`DTEND:${toFloatingIcsTime(end)}`);
    lines.push(foldLine(`SUMMARY:${escapeText(summary)}`));
    if (item.placeAddress) {
      lines.push(foldLine(`LOCATION:${escapeText(item.placeAddress)}`));
    }
    if (descriptionParts.length > 0) {
      lines.push(foldLine(`DESCRIPTION:${escapeText(descriptionParts.join("\n"))}`));
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
