"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Map as MapIcon, MapPin, Luggage, ListChecks, ClipboardCheck, Stethoscope, Plus } from "lucide-react";
import DayTimeline, { type TimelineItem, type TimelineRoute } from "./DayTimeline";
import TripMap, { type MapItem, type MapRoute } from "./TripMap";
import CollaboratorsPanel, { type Collaborator } from "./CollaboratorsPanel";
import JournalSharePanel from "./JournalSharePanel";
import EmergencyInfoCard from "./EmergencyInfoCard";
import BudgetSummary from "./BudgetSummary";
import TravelModeView from "./TravelModeView";
import type { ChecklistItemView } from "./ChecklistTab";
import SmartBanner from "./SmartBanner";
import { Skeleton } from "./LoadingSkeleton";

// Code-split out of the trip page's initial bundle — both are only
// rendered once the user actually switches to that mode (default mode is
// "edit"/timeline), yet were previously a static import each, shipping
// ~770 combined lines plus dnd-kit (via ChecklistTab's drag-to-reorder) to
// every visitor who never opens either tab. Deliberately NOT `ssr: false`:
// the home page's 行程健檢 hero button deep-links straight to
// `?mode=doctor` (and there's an equivalent checklist link), where `mode`
// is "doctor"/"checklist" from the very first render — ssr:false would
// have server-rendered nothing for that case and shown the loading
// fallback first, undermining the whole point of a "jump straight to the
// result" deep link. Leaving ssr at its default (true) still skips
// downloading either chunk for the common case (mode starts "edit", so
// neither is rendered at all on first paint) while still letting the
// deep-link case be server-rendered like before.
const ChecklistTab = dynamic(() => import("./ChecklistTab"), {
  loading: () => <div className="py-10 text-center text-sm text-ink-500">載入中…</div>,
});
const TripDoctorTab = dynamic(() => import("./TripDoctorTab"), {
  loading: () => <div className="py-10 text-center text-sm text-ink-500">載入中…</div>,
});
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
  initialMode,
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
  // Deep-link entry (?mode=doctor from the home hero's 行程健檢 button);
  // already whitelisted server-side in trips/[id]/page.tsx.
  initialMode?: "travel" | "checklist" | "doctor";
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
  // Starts at days[0] even for a ?mode=travel deep link — localTodayStr()
  // reads the viewer's local calendar day, which can disagree with the
  // server's UTC "today" during the viewer's early morning in any UTC+
  // timezone (see localTodayStr's own comment). Computing it in this
  // initializer would make the SSR HTML and the first client render pick
  // different days, a hydration mismatch. The effect below corrects the
  // selection client-side once mounted, same deferred pattern as
  // GreetingHero uses for the same class of problem.
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id);
  const [mode, setMode] = useState<"edit" | "travel" | "checklist" | "doctor">(
    initialMode ?? "edit"
  );
  useEffect(() => {
    if (initialMode !== "travel") return;
    const today = localTodayStr();
    const todayDay = days.find((d) => d.date === today);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (todayDay) setSelectedDayId(todayDay.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Same deferred-to-client reasoning as selectedDayId above — starts null
  // (SSR and first client paint agree: nothing is marked "today" yet) and
  // resolves once mounted.
  const [todayStr, setTodayStr] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTodayStr(localTodayStr());
  }, []);
  // Drives the highlighted marker + InfoWindow on the map, the matching
  // ring on its timeline card, and the map-panel legend row — set by
  // clicking any of those three. Falls away on its own when the day
  // changes (see TripMap: only renders a match if the id belongs to the
  // day currently shown).
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  // Mobile-only "時間軸／地圖" toggle for edit mode (see the segmented
  // control below) — desktop ignores this entirely and always shows both
  // side by side via the lg: grid, so this never needs resetting when
  // switching days/modes.
  const [mobileMapView, setMobileMapView] = useState(false);
  // handleLocateItem flips mobileMapView on to reveal the (until-then
  // CSS-hidden) map panel — the scroll itself has to wait for that state
  // update to actually commit, or it runs against a still-`display:none`
  // element and silently does nothing. Deferred to the effect below,
  // keyed on mobileMapView, instead of firing in the same tick.
  const scrollToMapRef = useRef(false);
  useEffect(() => {
    if (mobileMapView && scrollToMapRef.current) {
      scrollToMapRef.current = false;
      document
        .getElementById("day-map-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [mobileMapView]);

  function handleLocateItem(itemId: string) {
    setSelectedItemId(itemId);
    // On mobile the map is hidden behind the toggle unless already
    // selected — switch to it first so the effect above scrolls once it's
    // actually visible. A no-op on desktop, where the map is already in
    // view (mobileMapView flips true in state but every lg: class ignores
    // it).
    scrollToMapRef.current = true;
    setMobileMapView(true);
  }
  // One-shot highlight for an item just added from the explore page (see
  // the sessionStorage handshake in ExploreClient's handleAdd) — jump to
  // that day and let DayTimeline wash the new card so the user sees where
  // their place landed. Consumed (removed) immediately so it fires once.
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("trip-planner:last-added");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        tripId?: string;
        dayId?: string;
        itemId?: string;
      };
      if (parsed.tripId !== tripId) return;
      sessionStorage.removeItem("trip-planner:last-added");
      if (parsed.dayId && days.some((d) => d.id === parsed.dayId)) {
        // Same pattern as GreetingHero: sessionStorage only exists in the
        // browser, so this must run post-mount (a useState initializer
        // would desync server and client HTML and break hydration).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedDayId(parsed.dayId);
        setHighlightItemId(parsed.itemId ?? null);
        // Cleared once the 2s wash has played — DayTimeline remounts on
        // every day switch (key={selectedDay.id}), so leaving this set
        // made each later visit to that day re-scroll and re-highlight.
        const timer = setTimeout(() => setHighlightItemId(null), 2500);
        return () => clearTimeout(timer);
      }
    } catch {
      // Broken/unavailable storage — skip the highlight, nothing else
      // depends on it.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    // Distinguishes "still fetching" from "fetched, genuinely unavailable"
    // (e.g. the trip is outside Open-Meteo's ~16-day forecast window,
    // which legitimately resolves to null forever) — only the former
    // should show a loading skeleton. Days with no place item at all never
    // get a weather fetch triggered (see the effect above), so they're
    // never "loading" either.
    isWeatherLoading:
      day.timelineItems.some((i) => i.place) && !(day.id in weatherByDay),
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

  // Day Tabs' sliding underline — was the app's one and only framer-motion
  // usage (a `layoutId`-based shared-element transition), replaced with a
  // plain measured-position + CSS-transition approach so the trip page no
  // longer ships that dependency for a single decorative indicator.
  const tabListRef = useRef<HTMLDivElement>(null);
  const [underlineStyle, setUnderlineStyle] = useState<{
    left: number;
    width: number;
  } | null>(null);
  useEffect(() => {
    const activeButton = tabListRef.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]'
    );
    setUnderlineStyle(
      activeButton
        ? { left: activeButton.offsetLeft, width: activeButton.offsetWidth }
        : null
    );
  }, [selectedDay?.id]);

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
        className="fixed inset-x-0 bottom-0 z-[var(--z-bottom-bar)] flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
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

      {/* At most ONE proactive banner at a time (UI v3 §六), all backed by
          real data: doctor issues take priority over weather reminders.
          Hidden inside the doctor tab itself (pointing at where you
          already are is noise). Dismiss keys carry the salient state so a
          changed situation resurfaces after an earlier dismissal. */}
      {(() => {
        const issueCount = doctorFindings.filter((f) => f.severity === "issue").length;
        if (issueCount > 0 && mode !== "doctor") {
          return (
            <div className="mb-4">
              <SmartBanner
                dismissKey={`doctor:${tripId}:${issueCount}`}
                variant="warning"
                title={`行程健檢發現 ${issueCount} 個需要調整的項目`}
                description="時間、交通或營業時間可能有衝突"
                action={
                  <button
                    type="button"
                    onClick={() => setMode("doctor")}
                    className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
                  >
                    查看健檢結果
                  </button>
                }
              />
            </div>
          );
        }
        const weatherReminder = selectedDay?.weather
          ? getWeatherReminders(selectedDay.weather)[0]
          : undefined;
        if (weatherReminder && selectedDay && mode === "edit") {
          return (
            <div className="mb-4">
              <SmartBanner
                dismissKey={`weather:${selectedDay.id}:${selectedDay.weather!.weatherCode}`}
                variant="info"
                title={`Day ${selectedDay.dayIndex}：${weatherReminder}`}
              />
            </div>
          );
        }
        return null;
      })()}

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
        <TripDoctorTab tripId={tripId} findings={doctorFindings} />
      ) : mode === "travel" ? (
        selectedDay ? (
          <TravelModeView day={selectedDay} />
        ) : (
          <p className="text-sm text-ink-700">這個行程還沒有天數。</p>
        )
      ) : (
      <div>
      {/* Mobile-only "時間軸／地圖" toggle — the map is a different view of
          the same day's data (like edit mode itself), not a separate
          top-level feature, so it doesn't belong in the bottom tab bar
          alongside 檢查清單/行程健檢. Desktop already shows both side by
          side (see the lg: grid below) and has no size problem, so this
          stays lg:hidden rather than becoming a fifth shared mode.
          `sticky` (not just static) because the map uses gestureHandling=
          "greedy" — a one-finger drag anywhere on it pans the map instead
          of scrolling the page, so once you're a screen-height down inside
          the map there'd be no way to drag back up to a static toggle.
          Pinning it to the top of the viewport keeps it one tap away
          regardless of scroll position. */}
      <div className="sticky top-2 z-10 mb-3 inline-flex rounded-lg border border-line bg-surface p-1 text-sm shadow-sm lg:hidden">
        <button
          type="button"
          onClick={() => setMobileMapView(false)}
          aria-pressed={!mobileMapView}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
            !mobileMapView ? "bg-brand-600 text-white" : "text-ink-700 hover:bg-paper-alt"
          }`}
        >
          <ListChecks className="h-4 w-4" />
          時間軸
        </button>
        <button
          type="button"
          onClick={() => setMobileMapView(true)}
          aria-pressed={mobileMapView}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
            mobileMapView ? "bg-brand-600 text-white" : "text-ink-700 hover:bg-paper-alt"
          }`}
        >
          <MapIcon className="h-4 w-4" />
          地圖
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      {/* Day timeline */}
      <div className={mobileMapView ? "hidden lg:block" : ""}>
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="選擇日期"
          className="relative flex gap-1 overflow-x-auto border-b border-line pb-0 snap-x snap-mandatory"
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
              </button>
            );
          })}
          {underlineStyle && (
            <div
              aria-hidden="true"
              className="absolute bottom-0 h-0.5 bg-brand-600 transition-[left,width] duration-200 ease-out motion-reduce:transition-none"
              style={{ left: underlineStyle.left, width: underlineStyle.width }}
            />
          )}
        </div>

        {selectedDay ? (
          <section key={selectedDay.id} className="mt-4 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
                <span>
                  Day {selectedDay.dayIndex} · {selectedDay.date}
                </span>
                {selectedDay.weather && SelectedWeatherIcon ? (
                  <span className="flex items-center gap-1 rounded-full bg-info-50 px-2 py-0.5 text-sm font-normal text-info-700">
                    <SelectedWeatherIcon className="h-4 w-4" />
                    <span>
                      {Math.round(selectedDay.weather.maxTemp)}° /{" "}
                      {Math.round(selectedDay.weather.minTemp)}°
                    </span>
                  </span>
                ) : (
                  selectedDay.isWeatherLoading && (
                    <Skeleton className="h-[22px] w-16 rounded-full" />
                  )
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
                  className="mt-1 text-sm text-info-700"
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
                highlightItemId={highlightItemId}
                selectedItemId={selectedItemId}
                onLocateItem={handleLocateItem}
              />
            </div>
          </section>
        ) : (
          <p className="mt-4 text-sm text-ink-700">這個行程還沒有天數。</p>
        )}
      </div>

      {/* Map panel — always scoped to the day selected above. Hidden on
          mobile unless the toggle above is on "地圖" (see mobileMapView) —
          desktop ignores that state and always shows this via lg:block. */}
      <aside className="space-y-4 lg:sticky lg:top-10">
        <div
          id="day-map-panel"
          className={`h-fit rounded-xl border border-line bg-surface p-4 shadow-sm ${
            mobileMapView ? "" : "hidden lg:block"
          }`}
        >
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
            <MapIcon className="h-4 w-4" />
            地圖{selectedDay && ` · Day ${selectedDay.dayIndex}`}
          </h3>
          <div
            className={
              mobileMapView ? "mt-3 h-[70vh] lg:h-[480px]" : "mt-3 hidden lg:block lg:h-[480px]"
            }
          >
            <TripMap
              apiKey={apiKey}
              selectedItemId={selectedItemId}
              onSelectItem={setSelectedItemId}
              // All days now (not just the selected one) — TripMap shows
              // its own day dropdown when there's more than one, wired to
              // the same selectedDayId/setSelectedDayId as the Day Tabs
              // above so switching days from inside the map view (handy
              // once it's the mobile full-screen view) keeps the timeline
              // in sync instead of drifting independently.
              days={daysWithWeather.map((d) => ({
                id: d.id,
                dayIndex: d.dayIndex,
                items: d.mapItems,
                routes: d.mapRoutes,
              }))}
              selectedDayId={selectedDay?.id}
              onSelectDay={setSelectedDayId}
            />
          </div>
          <ul className="mt-4 space-y-2">
            {selectedDay?.mapItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedItemId(item.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition ${
                    item.id === selectedItemId
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-700 hover:bg-paper-alt"
                  }`}
                >
                  <MapPin className="h-4 w-4 shrink-0 text-ink-500" />
                  <span className="flex-1">{item.name}</span>
                  <span className="text-xs text-ink-500">
                    {item.lat.toFixed(3)}, {item.lng.toFixed(3)}
                  </span>
                </button>
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
      </div>
      )}
      </div>
    </div>
  );
}
