"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Map as MapIcon, MapPin, Luggage, ListChecks, ClipboardCheck, Stethoscope, Plus } from "lucide-react";
import DayTimeline, { type TimelineItem, type TimelineRoute } from "./DayTimeline";
import TripMap, { type MapItem, type MapRoute } from "./TripMap";
import CollaboratorsPanel, { type Collaborator } from "./CollaboratorsPanel";
import JournalSharePanel from "./JournalSharePanel";
import EmergencyInfoCard from "./EmergencyInfoCard";
import BudgetSummary from "./BudgetSummary";
import TravelModeView from "./TravelModeView";
import ChecklistTab, { type ChecklistItemView } from "./ChecklistTab";
import TripDoctorTab from "./TripDoctorTab";
import { runTripDoctor, type DoctorDay } from "@/lib/tripDoctor";
import { fetchDayWeather } from "@/app/trips/actions";
import {
  weatherLabel,
  getWeatherReminders,
  WEATHER_UNAVAILABLE_MESSAGE,
  type DailyWeather,
} from "@/lib/weather";
import { getNextStop, localTodayStr } from "@/lib/timeline";
import { formatTime } from "@/lib/labels";

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
  journalShareEnabled,
  journalShareToken,
  checklistItems,
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
  journalShareEnabled: boolean;
  journalShareToken: string | null;
  checklistItems: ChecklistItemView[];
}) {
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id);
  const [mode, setMode] = useState<"edit" | "travel" | "checklist" | "doctor">("edit");
  const shouldReduceMotion = useReducedMotion();
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

  // Pure/synchronous — every field here is already loaded client-side, so
  // this can just be recomputed on render instead of needing its own
  // effect/loading state.
  const doctorFindings = runTripDoctor(
    daysWithWeather.map(
      (day): DoctorDay => ({
        id: day.id,
        dayIndex: day.dayIndex,
        date: day.date,
        weather: day.weather,
        items: day.timelineItems.map((item) => ({
          id: item.id,
          startTime: item.startTime,
          endTime: item.endTime,
          place: item.place ? { name: item.place.name, openHours: item.place.openHours } : null,
        })),
        routes: day.timelineRoutes.map((route) => ({
          fromItemId: route.fromItemId,
          toItemId: route.toItemId,
          durationMin: route.durationMin,
        })),
      })
    )
  );

  const selectedDay =
    daysWithWeather.find((d) => d.id === selectedDayId) ?? daysWithWeather[0];
  const todayStr = localTodayStr();
  // Mirrors what page.tsx's Trip Hero used to compute from "today's real
  // date" — moved here so it follows whichever Day Tab is selected instead
  // (client state the server-rendered hero can't see).
  const selectedDayNextStop = selectedDay ? getNextStop(selectedDay.timelineItems) : null;
  const SelectedWeatherIcon = selectedDay?.weather
    ? weatherLabel(selectedDay.weather.weatherCode).icon
    : null;

  function switchToTravelMode() {
    const today = daysWithWeather.find((d) => d.date === todayStr);
    if (today) setSelectedDayId(today.id);
    setMode("travel");
  }

  // Shared by both the desktop pill switcher and the mobile bottom tab bar
  // below, so the three modes/labels/icons can't drift out of sync between
  // the two responsive variants of the same control.
  const modeTabs = [
    { key: "edit" as const, label: "編輯模式", icon: ListChecks, onSelect: () => setMode("edit") },
    { key: "travel" as const, label: "旅行模式", icon: Luggage, onSelect: switchToTravelMode },
    {
      key: "checklist" as const,
      label: "檢查清單",
      icon: ClipboardCheck,
      onSelect: () => setMode("checklist"),
    },
    {
      key: "doctor" as const,
      label: "行程健檢",
      icon: Stethoscope,
      onSelect: () => setMode("doctor"),
    },
  ];

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="檢視模式"
          className="hidden rounded-lg border border-line bg-surface p-1 text-sm lg:inline-flex"
        >
          {modeTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={mode === tab.key}
              onClick={tab.onSelect}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
                mode === tab.key
                  ? "bg-brand-600 text-white"
                  : "text-ink-700 hover:bg-paper-alt"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
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

      {/* Mobile-only bottom tab bar — this is where most time is actually
          spent (planning/viewing a trip), so the mode switch lives in the
          thumb zone instead of only at the top. Desktop keeps the pill
          switcher above since there's no reachability problem with a mouse.
          pb-24 on the root div above reserves room so this doesn't cover
          the bottom of the timeline/checklist content. */}
      <nav
        role="tablist"
        aria-label="檢視模式"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {modeTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={mode === tab.key}
            onClick={tab.onSelect}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
              mode === tab.key ? "text-brand-600" : "text-ink-500"
            }`}
          >
            <tab.icon className={`h-5 w-5 ${mode === tab.key ? "text-brand-600" : "text-ink-400"}`} />
            {tab.label}
          </button>
        ))}
      </nav>

      <div key={mode} className="animate-fade-in">
      {mode === "checklist" ? (
        <ChecklistTab
          tripId={tripId}
          items={checklistItems}
          members={collaborators.map((c) => ({
            userId: c.userId,
            name: c.name,
            avatarUrl: c.avatarUrl,
          }))}
          canEdit={canEdit}
        />
      ) : mode === "doctor" ? (
        <TripDoctorTab findings={doctorFindings} />
      ) : mode === "travel" ? (
        selectedDay ? (
          <TravelModeView day={selectedDay} />
        ) : (
          <p className="text-sm text-ink-700">這個行程還沒有天數。</p>
        )
      ) : (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      {/* Day timeline */}
      <div>
        <div
          role="tablist"
          aria-label="選擇日期"
          className="flex gap-1 overflow-x-auto border-b border-line pb-0 snap-x snap-mandatory"
        >
          {daysWithWeather.map((day) => {
            const isActive = day.id === selectedDay?.id;
            const isToday = day.date === todayStr;
            return (
              <button
                key={day.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedDayId(day.id)}
                className={`relative shrink-0 snap-start rounded-t-lg px-3 py-2 text-left min-w-[76px] transition ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-700 hover:bg-paper-alt"
                }`}
              >
                <div className="flex items-center gap-1 text-sm font-semibold">
                  <span>Day {day.dayIndex}</span>
                  {isToday && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-brand-600"
                      aria-hidden="true"
                    />
                  )}
                  {day.weather &&
                    (() => {
                      const WeatherIcon = weatherLabel(day.weather.weatherCode).icon;
                      return <WeatherIcon className="h-3.5 w-3.5" />;
                    })()}
                </div>
                <div className={`mt-0.5 text-xs ${isActive ? "text-brand-600" : "text-ink-500"}`}>
                  {day.date.slice(5)}
                  {isToday && "・今天"}
                </div>
                {isActive && (
                  <motion.div
                    layoutId="day-tab-indicator"
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-600"
                    transition={
                      shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 35 }
                    }
                  />
                )}
              </button>
            );
          })}
        </div>

        {selectedDay ? (
          <section key={selectedDay.id} className="mt-4 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
                <span>
                  Day {selectedDay.dayIndex} · {selectedDay.date}
                </span>
                {selectedDay.weather && SelectedWeatherIcon && (
                  <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-sm font-normal text-sky-700">
                    <SelectedWeatherIcon className="h-4 w-4" />
                    <span>
                      {Math.round(selectedDay.weather.maxTemp)}° /{" "}
                      {Math.round(selectedDay.weather.minTemp)}°
                    </span>
                  </span>
                )}
              </h2>
              <span className="text-sm text-ink-500">
                {selectedDay.timelineItems.length} 個景點
              </span>
            </div>
            {selectedDay.note && (
              <p className="mt-0.5 text-sm text-ink-500">{selectedDay.note}</p>
            )}
            {selectedDayNextStop && (
              <p className="mt-1 text-sm text-ink-700">
                <span className="font-medium">下一站</span>{" "}
                {selectedDayNextStop.place?.name ?? selectedDayNextStop.note ?? "未命名項目"}
                {selectedDayNextStop.startTime &&
                  ` · ${formatTime(selectedDayNextStop.startTime)}`}
              </p>
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
              <p className="mt-1 text-xs text-ink-400">
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
        <div className="h-fit rounded-xl border border-line bg-surface p-4 shadow-sm">
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

        <JournalSharePanel
          tripId={tripId}
          canManage={isOwner}
          journalShareEnabled={journalShareEnabled}
          journalShareToken={journalShareToken}
        />
      </aside>
      </div>
      )}
      </div>
    </div>
  );
}
