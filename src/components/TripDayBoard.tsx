"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Map as MapIcon, MapPin, Luggage, ListChecks, Plus } from "lucide-react";
import DayTimeline, { type TimelineItem, type TimelineRoute } from "./DayTimeline";
import TripMap, { type MapItem, type MapRoute } from "./TripMap";
import CollaboratorsPanel, { type Collaborator } from "./CollaboratorsPanel";
import EmergencyInfoCard from "./EmergencyInfoCard";
import BudgetSummary from "./BudgetSummary";
import TravelModeView from "./TravelModeView";
import { fetchDayWeather } from "@/app/trips/actions";
import {
  weatherLabel,
  getWeatherReminders,
  WEATHER_UNAVAILABLE_MESSAGE,
  type DailyWeather,
} from "@/lib/weather";

export type BoardDay = {
  id: string;
  dayIndex: number;
  date: string;
  note?: string | null;
  weather: DailyWeather | null;
  anchorItemId: string | null;
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
  emergencyInfo,
  canEdit,
  isOwner,
  shareEnabled,
  shareToken,
  shareRole,
}: {
  tripId: string;
  apiKey?: string;
  days: BoardDay[];
  collaborators: Collaborator[];
  emergencyInfo: string | null;
  canEdit: boolean;
  isOwner: boolean;
  shareEnabled: boolean;
  shareToken: string | null;
  shareRole: "EDITOR" | "VIEWER" | null;
}) {
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id);
  const [mode, setMode] = useState<"edit" | "travel">("edit");
  // Weather is fetched client-side, after this page has already rendered —
  // open-meteo has no SLA, and fetching it during SSR for every day meant
  // the whole trip page waited on the slowest of N external calls.
  const [weatherByDay, setWeatherByDay] = useState<Record<string, DailyWeather | null>>(
    {}
  );
  const dayIdsKey = days.map((d) => d.id).join(",");

  useEffect(() => {
    let cancelled = false;
    for (const day of days) {
      const firstPlace = day.timelineItems.find((i) => i.place)?.place;
      if (!firstPlace) continue;
      fetchDayWeather(firstPlace.lat, firstPlace.lng, day.date).then((result) => {
        if (!cancelled) {
          setWeatherByDay((prev) => ({ ...prev, [day.id]: result }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIdsKey]);

  const daysWithWeather = days.map((day) => ({
    ...day,
    weather: weatherByDay[day.id] ?? day.weather,
  }));

  const selectedDay =
    daysWithWeather.find((d) => d.id === selectedDayId) ?? daysWithWeather[0];

  function switchToTravelMode() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = daysWithWeather.find((d) => d.date === todayStr);
    if (today) setSelectedDayId(today.id);
    setMode("travel");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
              mode === "edit"
                ? "bg-brand-600 text-white"
                : "text-ink-700 hover:bg-slate-50"
            }`}
          >
            <ListChecks className="h-4 w-4" />
            編輯模式
          </button>
          <button
            type="button"
            onClick={switchToTravelMode}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
              mode === "travel"
                ? "bg-brand-600 text-white"
                : "text-ink-700 hover:bg-slate-50"
            }`}
          >
            <Luggage className="h-4 w-4" />
            旅行模式
          </button>
        </div>

        {/* Uses selectedDayId (client state) so this always points at
            whichever day is actually being viewed — a server-rendered
            version of this link can't know that, since day selection
            lives here, not in the page. */}
        {canEdit && selectedDay && (
          <Link
            href={`/explore?tripId=${tripId}&dayId=${selectedDay.id}`}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            加入景點/餐廳
          </Link>
        )}
      </div>

      {mode === "travel" ? (
        selectedDay ? (
          <TravelModeView day={selectedDay} />
        ) : (
          <p className="text-sm text-ink-700">這個行程還沒有天數。</p>
        )
      ) : (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      {/* Day timeline */}
      <div>
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory">
          {daysWithWeather.map((day) => {
            const isActive = day.id === selectedDay?.id;
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => setSelectedDayId(day.id)}
                className={`shrink-0 snap-start rounded-2xl border p-3 text-left min-w-[92px] ${
                  isActive
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-200 bg-white text-ink-700 hover:border-brand-300"
                }`}
              >
                <div className="flex items-center gap-1 text-sm font-semibold">
                  <span>Day {day.dayIndex}</span>
                  {day.weather && <span>{weatherLabel(day.weather.weatherCode).emoji}</span>}
                </div>
                <div
                  className={`mt-0.5 text-xs ${isActive ? "text-white/80" : "text-ink-500"}`}
                >
                  {day.date.slice(5)}
                </div>
                {day.note && (
                  <div
                    className={`mt-0.5 truncate text-xs ${
                      isActive ? "text-white/80" : "text-ink-500"
                    }`}
                  >
                    {day.note}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {selectedDay ? (
          <section className="mt-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
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
            {selectedDay.note && (
              <p className="mt-0.5 text-sm text-ink-500">{selectedDay.note}</p>
            )}

            {selectedDay.weather ? (
              getWeatherReminders(selectedDay.weather).map((reminder) => (
                <p
                  key={reminder}
                  className="mt-1 text-sm text-sky-700"
                >
                  {reminder}
                </p>
              ))
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                {WEATHER_UNAVAILABLE_MESSAGE}
              </p>
            )}

            <div className="mt-4">
              <DayTimeline
                key={selectedDay.id}
                tripId={tripId}
                dayId={selectedDay.id}
                dayDate={selectedDay.date}
                items={selectedDay.timelineItems}
                routes={selectedDay.timelineRoutes}
                anchorItemId={selectedDay.anchorItemId}
                defaultCountry={
                  selectedDay.timelineItems
                    .find((i) => i.place)
                    ?.place?.country.toUpperCase() || "JP"
                }
                otherDays={daysWithWeather
                  .filter((d) => d.id !== selectedDay.id)
                  .map((d) => ({ id: d.id, dayIndex: d.dayIndex, date: d.date }))}
                canEdit={canEdit}
              />
            </div>
          </section>
        ) : (
          <p className="mt-4 text-sm text-ink-700">這個行程還沒有天數。</p>
        )}
      </div>

      {/* Map panel — always scoped to the day selected above */}
      <aside className="space-y-4 lg:sticky lg:top-10">
        <div className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
            <MapIcon className="h-4 w-4" />
            地圖{selectedDay && ` · Day ${selectedDay.dayIndex}`}
          </h3>
          <div className="mt-3 h-[260px] lg:h-[480px]">
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
                className="flex items-center gap-2 text-sm text-ink-700"
              >
                <MapPin className="h-4 w-4 shrink-0 text-ink-500" />
                <span className="flex-1">{item.name}</span>
                <span className="text-xs text-ink-500">
                  {item.lat.toFixed(3)}, {item.lng.toFixed(3)}
                </span>
              </li>
            ))}
            {selectedDay?.mapItems.length === 0 && (
              <p className="text-xs text-ink-500">這天還沒有地點。</p>
            )}
          </ul>
        </div>

        <BudgetSummary days={daysWithWeather} />

        <EmergencyInfoCard tripId={tripId} emergencyInfo={emergencyInfo} canEdit={canEdit} />

        <CollaboratorsPanel
          tripId={tripId}
          collaborators={collaborators}
          canManage={isOwner}
          shareEnabled={shareEnabled}
          shareToken={shareToken}
          shareRole={shareRole}
        />
      </aside>
      </div>
      )}
    </div>
  );
}
