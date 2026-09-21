"use client";

import { useState } from "react";
import { BookOpen, MapPin } from "lucide-react";
import { TYPE_LABEL } from "@/lib/labels";
import { weekdayLabel } from "@/lib/businessHours";
import JournalPhotoGrid from "./JournalPhotoGrid";
import CopyCaptionButton from "./CopyCaptionButton";
import DayFilterTabs from "./DayFilterTabs";
import { buildDayCaption, buildItemCaption, buildTripCaption } from "@/lib/igCaption";

export type JournalBookItem = {
  id: string;
  type: string;
  note: string | null;
  journalText: string | null;
  place: { name: string; address: string | null } | null;
  photos: { id: string; url: string }[];
};

export type JournalBookDay = {
  id: string;
  dayIndex: number;
  date: Date;
  items: JournalBookItem[];
};

export type JournalBookTrip = {
  title: string;
  startDate: Date;
  endDate: Date;
  coverImage: string | null;
  days: JournalBookDay[];
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Shared between the public no-login page (src/app/journal/[token]) and the
// signed-in preview (src/app/trips/[id]/journal) — same rendering either
// way, so a preview is a true WYSIWYG of what a public viewer would see.
//
// Visual language deliberately borrows from the login/welcome screens
// (font-script for handwritten accents, the dashed "route line" motif,
// rotated polaroid-style photo thumbnails) rather than inventing a new
// direction — this is the one page in the app meant to read as an actual
// travel journal rather than a planning tool.
export default function JournalBook({
  trip,
  showCopy = false,
}: {
  trip: JournalBookTrip;
  // Only the signed-in preview turns this on - the public share page is
  // for readers, not for lifting captions.
  showCopy?: boolean;
}) {
  const allDaysWithEntries = trip.days.filter((day) => day.items.length > 0);
  const [selectedDay, setSelectedDay] = useState("all");
  // Falls back to 全部 if the selected day disappears (e.g. data refresh).
  const daysWithEntries =
    selectedDay === "all"
      ? allDaysWithEntries
      : allDaysWithEntries.filter((d) => d.id === selectedDay);

  return (
    <>
      <section className="relative h-64 overflow-hidden rounded-card-lg shadow-soft sm:h-80">
        {trip.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trip.coverImage}
            alt={trip.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand-500 to-brand-700" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 400 260"
          preserveAspectRatio="none"
        >
          <path
            d="M20 40 Q 140 90 210 30 T 380 50"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeDasharray="6 7"
            opacity="0.7"
          />
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
          <p className="flex items-center gap-1.5 text-xs font-medium text-white/80">
            <BookOpen className="h-3.5 w-3.5" />
            旅遊書
          </p>
          <h1 className="mt-1 text-2xl font-bold drop-shadow-sm sm:text-3xl">
            {trip.title}
          </h1>
          <p className="mt-1 font-script text-xl text-white/90">
            {formatDate(trip.startDate)} ~ {formatDate(trip.endDate)}
          </p>
        </div>
      </section>

      {showCopy && allDaysWithEntries.length > 0 && (
        <div className="mt-4 flex justify-end">
          <CopyCaptionButton text={buildTripCaption(trip)} label="複製整趟 IG 文案" />
        </div>
      )}

      {allDaysWithEntries.length > 1 && (
        <div className="mt-6">
          <DayFilterTabs
            value={selectedDay}
            onChange={setSelectedDay}
            tabs={[
              { id: "all", label: "全部" },
              ...allDaysWithEntries.map((d) => ({
                id: d.id,
                label: `Day ${d.dayIndex}`,
                sub: formatDate(d.date).slice(5),
              })),
            ]}
          />
        </div>
      )}

      {allDaysWithEntries.length === 0 ? (
        <p className="mt-10 text-center text-sm text-ink-500">
          這本旅遊書還沒有內容，敬請期待。
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {daysWithEntries.map((day) => (
            <section key={day.id}>
              <div className="flex items-center gap-3">
                <span className="font-script text-3xl leading-none text-brand-600">
                  Day {day.dayIndex}
                </span>
                <div className="h-0 flex-1 border-t border-dashed border-brand-200" />
                <span className="shrink-0 text-xs text-ink-500">
                  {formatDate(day.date)}（{weekdayLabel(day.date)}）
                </span>
              </div>
              {showCopy && day.items.some((i) => i.journalText?.trim()) && (
                <div className="mt-3">
                  <CopyCaptionButton
                    text={buildDayCaption(day, trip.title)}
                    label={`複製 Day ${day.dayIndex} IG 文案`}
                  />
                </div>
              )}
              <div className="mt-4 space-y-6">
                {day.items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-card-lg border border-line bg-surface p-4 shadow-sm"
                  >
                    <h3 className="flex items-center gap-1.5 text-lg font-bold text-ink-900">
                      {item.place && <MapPin className="h-4 w-4 shrink-0 text-brand-500" />}
                      {item.place?.name ?? item.note ?? TYPE_LABEL[item.type] ?? "回憶"}
                    </h3>
                    {item.place?.address && (
                      <p className="mt-0.5 text-xs text-ink-500">{item.place.address}</p>
                    )}

                    <JournalPhotoGrid photos={item.photos} />

                    {item.journalText && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                        {item.journalText}
                      </p>
                    )}

                    {showCopy && (
                      <div className="mt-3">
                        <CopyCaptionButton
                          text={buildItemCaption(item, trip.title)}
                          label="複製 IG 文案"
                        />
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
