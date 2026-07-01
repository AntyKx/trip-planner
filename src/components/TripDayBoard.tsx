"use client";

import { useState } from "react";
import { Map as MapIcon, MapPin } from "lucide-react";
import DayTimeline, { type TimelineItem, type TimelineRoute } from "./DayTimeline";
import TripMap, { type MapItem, type MapRoute } from "./TripMap";
import CollaboratorsPanel, { type Collaborator } from "./CollaboratorsPanel";
import { weatherLabel, type DailyWeather } from "@/lib/weather";

export type BoardDay = {
  id: string;
  dayIndex: number;
  date: string;
  weather: DailyWeather | null;
  timelineItems: TimelineItem[];
  timelineRoutes: TimelineRoute[];
  mapItems: MapItem[];
  mapRoutes: MapRoute[];
};

export default function TripDayBoard({
  tripId,
  apiKey,
  days,
  collaborators,
}: {
  tripId: string;
  apiKey?: string;
  days: BoardDay[];
  collaborators: Collaborator[];
}) {
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id);
  const selectedDay = days.find((d) => d.id === selectedDayId) ?? days[0];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      {/* Day timeline */}
      <div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map((day) => {
            const isActive = day.id === selectedDay?.id;
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => setSelectedDayId(day.id)}
                className={
                  isActive
                    ? "shrink-0 rounded-full bg-teal-600 px-4 py-1.5 text-sm font-medium text-white"
                    : "shrink-0 rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
                }
              >
                Day {day.dayIndex}
                {day.weather && ` ${weatherLabel(day.weather.weatherCode).emoji}`}
              </button>
            );
          })}
        </div>

        {selectedDay ? (
          <section className="mt-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <span>
                Day {selectedDay.dayIndex} · {selectedDay.date}
              </span>
              {selectedDay.weather && (
                <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-sm font-normal text-sky-700">
                  <span>{weatherLabel(selectedDay.weather.weatherCode).emoji}</span>
                  <span>
                    {Math.round(selectedDay.weather.maxTemp)}° /{" "}
                    {Math.round(selectedDay.weather.minTemp)}°
                  </span>
                </span>
              )}
            </h2>

            <div className="mt-4">
              <DayTimeline
                key={selectedDay.id}
                tripId={tripId}
                dayId={selectedDay.id}
                items={selectedDay.timelineItems}
                routes={selectedDay.timelineRoutes}
              />
            </div>
          </section>
        ) : (
          <p className="mt-4 text-sm text-slate-600">這個行程還沒有天數。</p>
        )}
      </div>

      {/* Map panel — always scoped to the day selected above */}
      <aside className="space-y-4 lg:sticky lg:top-10">
        <div className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <MapIcon className="h-4 w-4" />
            地圖{selectedDay && ` · Day ${selectedDay.dayIndex}`}
          </h3>
          <div className="mt-3">
            <TripMap
              apiKey={apiKey}
              days={
                selectedDay
                  ? [
                      {
                        id: selectedDay.id,
                        dayIndex: selectedDay.dayIndex,
                        items: selectedDay.mapItems,
                        routes: selectedDay.mapRoutes,
                      },
                    ]
                  : []
              }
            />
          </div>
          <ul className="mt-4 space-y-2">
            {selectedDay?.mapItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 text-sm text-slate-600"
              >
                <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="flex-1">{item.name}</span>
                <span className="text-xs text-slate-600">
                  {item.lat.toFixed(3)}, {item.lng.toFixed(3)}
                </span>
              </li>
            ))}
            {selectedDay?.mapItems.length === 0 && (
              <p className="text-xs text-slate-400">這天還沒有地點。</p>
            )}
          </ul>
        </div>

        <CollaboratorsPanel tripId={tripId} collaborators={collaborators} />
      </aside>
    </div>
  );
}
