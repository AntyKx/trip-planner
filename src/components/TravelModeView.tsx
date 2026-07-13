"use client";

import { Navigation } from "lucide-react";
import { formatTime, TYPE_ICON } from "@/lib/labels";
import { getNextStop } from "@/lib/timeline";
import {
  weatherLabel,
  getWeatherReminders,
  WEATHER_UNAVAILABLE_MESSAGE,
} from "@/lib/weather";
import type { BoardDay } from "./TripDayBoard";

function navUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export default function TravelModeView({ day }: { day: BoardDay }) {
  const items = day.timelineItems;
  const nextStop = getNextStop(items);
  const WeatherIcon = day.weather ? weatherLabel(day.weather.weatherCode).icon : null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink-900">
        Day {day.dayIndex} · {day.date}
      </h2>

      {day.weather ? (
        <div className="mt-1 space-y-0.5">
          <p className="flex items-center gap-1 text-sm text-ink-700">
            {WeatherIcon && <WeatherIcon className="h-4 w-4" />}
            <span>
              {Math.round(day.weather.maxTemp)}° / {Math.round(day.weather.minTemp)}°
            </span>
          </p>
          {getWeatherReminders(day.weather).map((reminder) => (
            <p key={reminder} className="text-sm text-sky-700">
              {reminder}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-ink-400">{WEATHER_UNAVAILABLE_MESSAGE}</p>
      )}

      {nextStop && (
        <div className="mt-4 rounded-2xl bg-brand-600 p-5 text-white shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-100">
            下一站
          </p>
          <h3 className="mt-1 text-xl font-bold">
            {nextStop.place?.name ?? nextStop.note ?? "未命名項目"}
          </h3>
          {nextStop.startTime && (
            <p className="mt-1 text-brand-100">{formatTime(nextStop.startTime)}</p>
          )}
          {nextStop.place?.address && (
            <p className="mt-1 text-sm text-brand-100">{nextStop.place.address}</p>
          )}
          {nextStop.confirmationNumber && (
            <p className="mt-1 text-sm text-brand-100">
              🔖 {nextStop.confirmationNumber}
            </p>
          )}
          {nextStop.place && (
            <a
              href={navUrl(nextStop.place.lat, nextStop.place.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-sm font-medium hover:bg-white/30"
            >
              <Navigation className="h-4 w-4" />
              導航
            </a>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium text-ink-500">今日行程</p>
        {items.map((item) => {
          const TypeIcon = TYPE_ICON[item.type] ?? TYPE_ICON.CUSTOM;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                item.id === nextStop?.id
                  ? "border-brand-400 bg-brand-50"
                  : "border-line bg-surface"
              }`}
            >
              <TypeIcon className="h-4 w-4 shrink-0 text-ink-500" />
              <span className="w-12 shrink-0 text-sm text-ink-500">
                {formatTime(item.startTime)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink-900">
                  {item.place?.name ?? item.note ?? "未命名項目"}
                </p>
                {item.place?.address && (
                  <p className="truncate text-xs text-ink-500">
                    {item.place.address}
                  </p>
                )}
              </div>
              {item.place && (
                <a
                  href={navUrl(item.place.lat, item.place.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="開啟 Google Maps 導航"
                  className="shrink-0 p-2 text-ink-500 hover:text-brand-600"
                >
                  <Navigation className="h-4 w-4" />
                </a>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-sm text-ink-500">這天還沒有安排項目。</p>
        )}
      </div>
    </div>
  );
}
