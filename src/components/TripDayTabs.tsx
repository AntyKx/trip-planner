"use client";

import { useState } from "react";
import DayTimeline, { type TimelineItem, type TimelineRoute } from "./DayTimeline";
import { weatherLabel, type DailyWeather } from "@/lib/weather";

export type DayTabData = {
  id: string;
  dayIndex: number;
  date: string;
  weather: DailyWeather | null;
  items: TimelineItem[];
  routes: TimelineRoute[];
};

export default function TripDayTabs({
  tripId,
  days,
}: {
  tripId: string;
  days: DayTabData[];
}) {
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id);
  const selectedDay = days.find((d) => d.id === selectedDayId) ?? days[0];

  if (!selectedDay) {
    return <p className="text-sm text-slate-600">這個行程還沒有天數。</p>;
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((day) => {
          const isActive = day.id === selectedDay.id;
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => setSelectedDayId(day.id)}
              className={
                isActive
                  ? "shrink-0 rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white"
                  : "shrink-0 rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
              }
            >
              Day {day.dayIndex}
              {day.weather && ` ${weatherLabel(day.weather.weatherCode).emoji}`}
            </button>
          );
        })}
      </div>

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
            items={selectedDay.items}
            routes={selectedDay.routes}
          />
        </div>
      </section>
    </div>
  );
}
