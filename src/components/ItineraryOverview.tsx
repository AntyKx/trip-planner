import { MapPin, Star } from "lucide-react";
import { TYPE_LABEL, TYPE_ICON, TYPE_COLOR, MODE_LABEL, MODE_ICON, formatTime } from "@/lib/labels";
import { weekdayLabel } from "@/lib/businessHours";
import ImgWithFallback from "./ImgWithFallback";

export type ItineraryOverviewLeg = {
  mode: string;
  durationMin: number | null;
  distanceKm: number | null;
};

export type ItineraryOverviewItem = {
  id: string;
  type: string;
  startTime: Date | null;
  place: {
    name: string;
    address: string | null;
    rating: number | null;
    photoUrl: string | null;
  } | null;
  // The leg from this item to whichever one follows it — null for the
  // day's last item, or when auto-fill hasn't computed one yet.
  leg: ItineraryOverviewLeg | null;
};

export type ItineraryOverviewDay = {
  id: string;
  dayIndex: number;
  date: Date;
  anchorItemId: string | null;
  items: ItineraryOverviewItem[];
};

export type ItineraryOverviewTrip = {
  title: string;
  startDate: Date;
  endDate: Date;
  coverImage: string | null;
  days: ItineraryOverviewDay[];
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Shared between the public no-login page (src/app/itinerary/[token]) and
// the signed-in preview (src/app/trips/[id]/itinerary) — same rendering
// either way, so a preview is a true WYSIWYG of what a link recipient
// would see. Deliberately excludes confirmationNumber, note (private
// planning scribbles — see the Item.note comment), and cost amounts:
// this page is for someone deciding whether to show up, not someone who
// needs the booking reference or the trip's budget.
export default function ItineraryOverview({ trip }: { trip: ItineraryOverviewTrip }) {
  const daysWithStops = trip.days.filter((day) => day.items.length > 0);

  return (
    <>
      <section className="relative h-56 overflow-hidden rounded-card-lg shadow-soft sm:h-72">
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
          <p className="text-xs font-medium text-white/80">行程總覽・唯讀分享</p>
          <h1 className="mt-1 text-2xl font-bold drop-shadow-sm sm:text-3xl">
            {trip.title}
          </h1>
          <p className="mt-1 font-script text-xl text-white/90">
            {formatDate(trip.startDate)} ~ {formatDate(trip.endDate)}
          </p>
        </div>
      </section>

      {daysWithStops.length > 1 && (
        <nav className="sticky top-0 z-10 -mx-4 mt-4 flex gap-1.5 overflow-x-auto bg-paper/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
          {daysWithStops.map((day) => (
            <a
              key={day.id}
              href={`#day-${day.dayIndex}`}
              className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-700 hover:border-brand-300 hover:text-brand-700"
            >
              Day {day.dayIndex}
            </a>
          ))}
        </nav>
      )}

      {daysWithStops.length === 0 ? (
        <p className="mt-10 text-center text-sm text-ink-500">
          這趟行程還沒有排入任何景點。
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {daysWithStops.map((day) => (
            <section key={day.id} id={`day-${day.dayIndex}`} className="scroll-mt-16">
              <div className="flex items-center gap-3">
                <span className="font-script text-3xl leading-none text-brand-600">
                  Day {day.dayIndex}
                </span>
                <div className="h-0 flex-1 border-t border-dashed border-brand-200" />
                <span className="shrink-0 text-xs text-ink-500">
                  {formatDate(day.date)}（{weekdayLabel(day.date)}）
                </span>
              </div>

              <div className="relative mt-4 pl-8">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-2 left-[15px] top-2 w-0 border-l-2 border-dashed border-brand-200"
                />
                {day.items.map((item, index) => {
                  const TypeIcon = TYPE_ICON[item.type] ?? TYPE_ICON.CUSTOM;
                  const typeColor = TYPE_COLOR[item.type] ?? TYPE_COLOR.CUSTOM;
                  const isAnchor = item.id === day.anchorItemId;
                  const ModeIcon = item.leg ? MODE_ICON[item.leg.mode] : null;
                  return (
                    <div key={item.id} className="relative mb-3">
                      <span
                        aria-hidden="true"
                        className={`absolute -left-8 top-4 block rounded-full border-2 border-paper bg-brand-700 ${
                          isAnchor ? "h-3.5 w-3.5 ring-2 ring-brand-300" : "h-3 w-3"
                        }`}
                      />
                      {formatTime(item.startTime) && (
                        <span className="absolute -left-[42px] top-9 -rotate-2 font-script text-sm leading-none text-brand-700">
                          {formatTime(item.startTime)}
                        </span>
                      )}

                      <div
                        className={`flex items-stretch gap-3 rounded-xl border p-3 shadow-sm ${
                          isAnchor ? "border-brand-200 bg-brand-50/40" : "border-line bg-surface"
                        }`}
                      >
                        {item.place && (
                          <ImgWithFallback
                            src={item.place.photoUrl}
                            alt={item.place.name}
                            className="h-20 w-20 shrink-0 rounded-lg object-cover"
                            fallback={
                              <div
                                className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-lg ${typeColor.bg}`}
                              >
                                <TypeIcon className={`h-6 w-6 ${typeColor.text}`} />
                              </div>
                            }
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeColor.bg} ${typeColor.text}`}
                            >
                              <TypeIcon className="h-3 w-3" />
                              {TYPE_LABEL[item.type]}
                            </span>
                            {isAnchor && (
                              <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                                <MapPin className="h-3 w-3" />
                                本日起點
                              </span>
                            )}
                          </div>
                          <h3 className="mt-1 truncate text-base font-bold text-ink-900">
                            {item.place?.name ?? TYPE_LABEL[item.type]}
                          </h3>
                          {item.place?.rating != null && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-500">
                              <Star className="h-3.5 w-3.5 fill-amber-500" />
                              {item.place.rating.toFixed(1)}
                            </p>
                          )}
                          {item.place?.address && (
                            <p className="mt-0.5 truncate text-xs text-ink-500">
                              {item.place.address}
                            </p>
                          )}
                        </div>
                      </div>

                      {item.leg && index < day.items.length - 1 && (
                        <div className="ml-1 mt-2 inline-flex items-center gap-1.5 rounded-full bg-paper-alt px-3 py-1 text-xs text-ink-700">
                          {ModeIcon && <ModeIcon className="h-3.5 w-3.5 text-ink-500" />}
                          {MODE_LABEL[item.leg.mode] ?? item.leg.mode}
                          {item.leg.durationMin != null && (
                            <span>
                              ・{item.leg.durationMin} 分鐘
                              {item.leg.distanceKm != null && ` · ${item.leg.distanceKm} km`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-ink-400">
        由 Trip Planner 產生的唯讀分享頁・不含訂房確認碼與花費金額
      </p>
    </>
  );
}
