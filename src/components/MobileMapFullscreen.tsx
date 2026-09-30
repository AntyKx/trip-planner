"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { X, LocateFixed, Scan, Navigation, Loader2 } from "lucide-react";
import {
  DayMarkers,
  DayRoutes,
  START_MARKER_COLOR,
  fitMapToItems,
  stopLabel,
  type MapDay,
  type MapItem,
} from "./TripMap";
import { useToast } from "./Toast";
import { TYPE_COLOR, TYPE_LABEL, formatTime } from "@/lib/labels";

const MAP_ID = "trip-map-fullscreen";
const CLOSE_DURATION_MS = 220;

// The top bar (close + day chips) and the bottom card carousel both float
// over the map, so "fit all stops" and "center this stop" have to aim at
// the band between them rather than the whole screen, or stops end up
// hidden under a card.
const FIT_PADDING = { top: 150, right: 64, bottom: 200, left: 32 };
const CENTER_OFFSET_Y = (FIT_PADDING.bottom - FIT_PADDING.top) / 2;

const MY_LOCATION_ICON = {
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#1a73e8" fill-opacity=".18"/><circle cx="18" cy="18" r="8" fill="#1a73e8" stroke="white" stroke-width="3"/></svg>'
  )}`,
  scaledSize: { width: 36, height: 36 } as google.maps.Size,
  anchor: { x: 18, y: 18 } as google.maps.Point,
};

// panTo, but lands the point in the middle of the visible band (see
// FIT_PADDING) instead of the middle of the screen. Falls back to a plain
// panTo before the projection is ready (first frames after mount).
function panToVisibleCenter(map: google.maps.Map, pos: google.maps.LatLngLiteral) {
  const projection = map.getProjection();
  const zoom = map.getZoom();
  if (!projection || zoom == null) {
    map.panTo(pos);
    return;
  }
  const point = projection.fromLatLngToPoint(pos);
  if (!point) {
    map.panTo(pos);
    return;
  }
  const shifted = projection.fromPointToLatLng(
    new google.maps.Point(point.x, point.y + CENTER_OFFSET_Y / 2 ** zoom)
  );
  map.panTo(shifted ?? pos);
}

export type FullscreenMapDay = MapDay & { date: string };

// Mobile-only full-screen map, opened from the in-page preview map (see
// TripMap variant="preview") or a timeline card's 定位 button. There's no
// page behind it to scroll, so the map simply takes every gesture —
// one-finger pan, pinch zoom — with no lock toggle. The bottom carousel
// and the markers drive each other: swiping to a card pans to its marker,
// tapping a marker slides its card into view.
export default function MobileMapFullscreen({
  days,
  selectedDayId,
  onSelectDay,
  initialItemId,
  onSelectItem,
  onClose,
}: {
  days: FullscreenMapDay[];
  selectedDayId: string | undefined;
  onSelectDay: (id: string) => void;
  initialItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onClose: () => void;
}) {
  const map = useMap(MAP_ID);
  const toast = useToast();
  const day = days.find((d) => d.id === selectedDayId) ?? days[0];
  const items = day?.items ?? [];
  const itemsKey = items.map((i) => `${i.id}:${i.lat},${i.lng}`).join(",");

  const [activeItemId, setActiveItemId] = useState<string | null>(() =>
    items.some((i) => i.id === initialItemId) ? initialItemId : null
  );
  const activeIndex = items.findIndex((i) => i.id === activeItemId);

  // Opened on a specific stop — the Map mounts already centered on it (see
  // defaultCenter below), so the first fit-all pass must be skipped or it
  // would immediately zoom back out.
  const skipInitialFitRef = useRef(activeItemId != null);

  const [visible, setVisible] = useState(false);
  const [myPos, setMyPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [locating, setLocating] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ignore carousel scroll events we caused ourselves (scrollTo after a
  // marker tap / day switch) so they don't feed back into a selection.
  const programmaticScrollUntilRef = useRef(0);
  const closingRef = useRef(false);

  // Same double-rAF enter as ModalOverlay — one frame isn't always enough
  // for Safari to paint the starting state before the transition begins.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function finishClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    setTimeout(onClose, CLOSE_DURATION_MS);
  }

  // A full-screen view feels like its own page, so the phone's back
  // button / swipe-back should close it rather than leave the trip. Push a
  // same-URL history entry on open (Next.js' router integrates native
  // pushState, see "Native History API" in its linking docs) and close on
  // the matching popstate. The ✕ button and Escape go through
  // history.back() too, so that entry never lingers after closing.
  const pushedHistoryRef = useRef(false);
  useEffect(() => {
    if (!pushedHistoryRef.current) {
      pushedHistoryRef.current = true;
      window.history.pushState({ tripMapFullscreen: true }, "");
    }
    function onPopState() {
      finishClose();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestClose() {
    if (window.history.state?.tripMapFullscreen) {
      window.history.back();
    } else {
      finishClose();
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollToCard(index: number, smooth: boolean) {
    const carousel = carouselRef.current;
    const card = carousel?.children[index] as HTMLElement | undefined;
    if (!carousel || !card) return;
    programmaticScrollUntilRef.current = performance.now() + (smooth ? 700 : 150);
    carousel.scrollTo({
      left: card.offsetLeft - (carousel.clientWidth - card.offsetWidth) / 2,
      behavior: smooth ? "smooth" : "auto",
    });
  }

  // Frame the day on open and on every day switch (and when a stop moves).
  useEffect(() => {
    if (!map || items.length === 0) return;
    if (skipInitialFitRef.current) {
      skipInitialFitRef.current = false;
      return;
    }
    const listener = fitMapToItems(map, items, FIT_PADDING);
    return () => google.maps.event.removeListener(listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, itemsKey]);

  // Carousel position follows the day: the opened-on stop on first paint,
  // back to the first card after switching days.
  useEffect(() => {
    scrollToCard(Math.max(activeIndex, 0), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day?.id]);

  function focusItem(index: number, scrollCard: boolean) {
    const item = items[index];
    if (!item) return;
    setActiveItemId(item.id);
    onSelectItem(item.id);
    if (map) {
      if ((map.getZoom() ?? 0) < 13) map.setZoom(14);
      panToVisibleCenter(map, item);
    }
    if (scrollCard) scrollToCard(index, true);
  }

  function handleCarouselScroll() {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      if (performance.now() < programmaticScrollUntilRef.current) return;
      const carousel = carouselRef.current;
      if (!carousel) return;
      const mid = carousel.scrollLeft + carousel.clientWidth / 2;
      let best = 0;
      let bestDistance = Infinity;
      Array.from(carousel.children).forEach((child, i) => {
        const el = child as HTMLElement;
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      });
      if (best !== activeIndex) focusItem(best, false);
    }, 100);
  }

  function handleSelectDay(id: string) {
    if (id === day?.id) return;
    setActiveItemId(null);
    onSelectItem(null);
    onSelectDay(id);
  }

  function handleLocate() {
    if (!navigator.geolocation) {
      toast.error("這個裝置不支援定位");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPos(p);
        if (map) {
          if ((map.getZoom() ?? 0) < 15) map.setZoom(15);
          panToVisibleCenter(map, p);
        }
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "沒有定位權限，請到瀏覽器設定允許此網站使用位置"
            : "抓不到目前位置，請稍後再試"
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  const initialCenter =
    items.find((i) => i.id === activeItemId) ?? items[0] ?? { lat: 25.033, lng: 121.565 };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="全螢幕地圖"
      className={`fixed inset-0 z-[var(--z-modal)] bg-paper-alt transition duration-200 motion-reduce:transition-none ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <Map
        id={MAP_ID}
        style={{ position: "absolute", inset: 0 }}
        defaultCenter={initialCenter}
        defaultZoom={15}
        // Nothing to scroll behind a full-screen map, so the map takes
        // every touch directly — no two-finger rule, no lock toggle.
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
      >
        <DayMarkers
          items={items}
          selectedItemId={activeItemId}
          onSelectItem={(id) => {
            const index = items.findIndex((i) => i.id === id);
            if (index >= 0) focusItem(index, true);
          }}
        />
        {day && <DayRoutes day={day} />}
        {myPos && <Marker position={myPos} icon={MY_LOCATION_ICON} clickable={false} />}
      </Map>

      {/* Top bar: close, title, day chips */}
      <div className="absolute inset-x-0 top-0 z-10 space-y-2 bg-gradient-to-b from-white via-white/95 to-white/0 px-3 pb-5 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={requestClose}
            aria-label="關閉地圖"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-700 shadow-sm"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink-900">
              Day {day?.dayIndex}
            </p>
            <p className="text-xs text-ink-500">
              {day?.date} · {items.length} 個地點
            </p>
          </div>
        </div>
        {days.length > 1 && (
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
            {days.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => handleSelectDay(d.id)}
                aria-pressed={d.id === day?.id}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm shadow-sm ${
                  d.id === day?.id
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line bg-surface text-ink-700"
                }`}
              >
                Day {d.dayIndex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right-side controls, sitting just above the carousel */}
      <div className="absolute right-3 z-10 grid gap-2.5" style={{ bottom: 168 }}>
        <button
          type="button"
          onClick={handleLocate}
          aria-label="我的位置"
          className={`flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-md ${
            myPos ? "text-[#1a73e8]" : "text-ink-700"
          }`}
        >
          {locating ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <LocateFixed className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => map && items.length > 0 && fitMapToItems(map, items, FIT_PADDING)}
          aria-label="顯示全部景點"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink-700 shadow-md"
        >
          <Scan className="h-5 w-5" />
        </button>
      </div>

      {/* Bottom card carousel */}
      {items.length === 0 ? (
        <div className="absolute inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 rounded-2xl bg-surface p-4 text-center text-sm text-ink-500 shadow-lg">
          這天還沒有地點可顯示
        </div>
      ) : (
        <div
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          className="absolute inset-x-0 bottom-0 z-10 flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-7 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 [scrollbar-width:none]"
        >
          {items.map((item, i) => (
            <FullscreenCard
              key={item.id}
              item={item}
              index={i}
              active={i === activeIndex}
              onClick={() => focusItem(i, true)}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

function FullscreenCard({
  item,
  index,
  active,
  onClick,
}: {
  item: MapItem;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const color =
    index === 0 ? START_MARKER_COLOR : TYPE_COLOR[item.type]?.hex ?? TYPE_COLOR.PLACE.hex;
  const time = item.startTime ? formatTime(item.startTime) : null;
  return (
    <article
      onClick={onClick}
      className={`flex w-[calc(100vw-4.5rem)] max-w-sm shrink-0 cursor-pointer snap-center gap-3 rounded-2xl border-2 bg-surface p-2.5 shadow-lg transition-colors ${
        active ? "border-brand-600" : "border-transparent"
      }`}
    >
      <div
        className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl"
        style={{ background: color }}
      >
        {item.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        <span
          className="absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white px-1 text-xs font-bold text-white"
          style={{ background: color }}
        >
          {stopLabel(index)}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-xs text-ink-500 tabular-nums">
          {[time, TYPE_LABEL[item.type]].filter(Boolean).join(" · ")}
        </p>
        <h3 className="mt-0.5 truncate text-base font-semibold text-ink-900">{item.name}</h3>
        <div className="mt-auto flex items-center gap-2">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-sm font-medium text-brand-700"
          >
            <Navigation className="h-3.5 w-3.5" />
            導航
          </a>
        </div>
      </div>
    </article>
  );
}
