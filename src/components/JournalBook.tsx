import { BookOpen } from "lucide-react";
import { TYPE_LABEL } from "@/lib/labels";
import { weekdayLabel } from "@/lib/businessHours";

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
export default function JournalBook({ trip }: { trip: JournalBookTrip }) {
  const daysWithEntries = trip.days.filter((day) => day.items.length > 0);

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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
          <p className="flex items-center gap-1.5 text-xs font-medium text-white/80">
            <BookOpen className="h-3.5 w-3.5" />
            旅遊書
          </p>
          <h1 className="mt-1 text-2xl font-bold drop-shadow-sm sm:text-3xl">
            {trip.title}
          </h1>
          <p className="mt-1 text-sm text-white/90">
            {formatDate(trip.startDate)} ~ {formatDate(trip.endDate)}
          </p>
        </div>
      </section>

      {daysWithEntries.length === 0 ? (
        <p className="mt-10 text-center text-sm text-ink-500">
          這本旅遊書還沒有內容，敬請期待。
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {daysWithEntries.map((day) => (
            <section key={day.id}>
              <h2 className="text-sm font-semibold text-brand-700">
                Day {day.dayIndex} · {formatDate(day.date)}（{weekdayLabel(day.date)}）
              </h2>
              <div className="mt-3 space-y-6">
                {day.items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-card-lg border border-line bg-surface p-4 shadow-sm"
                  >
                    <h3 className="text-lg font-bold text-ink-900">
                      {item.place?.name ?? item.note ?? TYPE_LABEL[item.type] ?? "回憶"}
                    </h3>
                    {item.place?.address && (
                      <p className="mt-0.5 text-xs text-ink-500">{item.place.address}</p>
                    )}

                    {item.photos.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {item.photos.map((photo) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={photo.id}
                            src={photo.url}
                            alt=""
                            className="aspect-square w-full rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    )}

                    {item.journalText && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                        {item.journalText}
                      </p>
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
