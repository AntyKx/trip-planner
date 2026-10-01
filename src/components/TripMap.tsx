"use client";

import { useEffect, useState } from "react";
import { Map, Marker, InfoWindow, useMap } from "@vis.gl/react-google-maps";
import { Move, Check, Maximize2, Hand } from "lucide-react";
import { TYPE_COLOR, formatTime } from "@/lib/labels";
import { decodePolyline, polylineMatchesEndpoints } from "@/lib/polyline";

export const START_MARKER_COLOR = "#b45309";

// Builds a small colored-circle SVG data-URI icon so markers aren't Google's
// default red pin. Uses plain objects (not `new google.maps.Size/Point`) so
// this can run during React's render phase before the Maps script has
// necessarily finished loading — the Icon type is only used for annotation.
// `highlighted` bumps the size and stroke so the currently-selected item
// (clicked on the map or "located" from a timeline card) stands out.
export function buildMarkerIcon(
  label: string,
  hexColor: string,
  highlighted = false
): google.maps.Icon {
  const size = highlighted ? 38 : 30;
  const strokeWidth = highlighted ? 3 : 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${
    size / 2
  }" cy="${size / 2}" r="${
    size / 2 - 1.5
  }" fill="${hexColor}" stroke="white" stroke-width="${strokeWidth}"/><text x="${size / 2}" y="${
    size / 2 + 4
  }" font-family="sans-serif" font-size="12" font-weight="700" fill="white" text-anchor="middle">${label}</text></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: size, height: size } as google.maps.Size,
    anchor: { x: size / 2, y: size / 2 } as google.maps.Point,
  };
}

export type MapItem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  country?: string;
  // For the InfoWindow shown when this item is selected (map marker click
  // or the timeline card's "locate" button) — optional since not every
  // caller needs to thread these through.
  photoUrl?: string | null;
  startTime?: string | Date | null;
};

export type MapRoute = {
  fromItemId: string;
  toItemId: string;
  mode: "WALK" | "TRANSIT" | "DRIVE" | "BIKE" | "FLY";
  // Cached encoded line for this leg (Route.rawPolyline). null = not
  // cached yet (fetch once, then report it via onRoutePolyline); "" =
  // Google has no route for it, don't ask again.
  polyline?: string | null;
};

// Called after RouteSegment had to ask Google for a leg's line, so the
// caller can persist it (TripDayBoard -> cacheRoutePolyline).
export type RoutePolylineHandler = (dayId: string, route: MapRoute, polyline: string) => void;

// Lines fetched this session, shared by every map instance (panel,
// preview, full-screen). The server-rendered routes still say "not cached"
// until the next page load, so without this the full-screen map would
// re-fetch every leg the preview had just fetched.
// globalThis.Map — `Map` here is the Google map component imported above.
const sessionPolylines = new globalThis.Map<string, string>();
function polylineKey(from: MapItem, to: MapItem, mode: MapRoute["mode"]) {
  return `${from.id}>${to.id}:${mode}:${from.lat},${from.lng}>${to.lat},${to.lng}`;
}

export type MapDay = {
  id: string;
  dayIndex: number;
  items: MapItem[];
  routes: MapRoute[];
};

// FLY has no entry — there's no real routable path for a flight, so it's
// drawn as a straight dashed line below instead of ever reaching
// DirectionsService.
const TRAVEL_MODE_MAP: Partial<Record<MapRoute["mode"], google.maps.TravelMode>> = {
  WALK: "WALKING" as google.maps.TravelMode,
  TRANSIT: "TRANSIT" as google.maps.TravelMode,
  DRIVE: "DRIVING" as google.maps.TravelMode,
  BIKE: "BICYCLING" as google.maps.TravelMode,
};

export function RouteSegment({
  from,
  to,
  mode,
  cachedPolyline,
  onFetched,
}: {
  from: MapItem;
  to: MapItem;
  mode: MapRoute["mode"];
  cachedPolyline?: string | null;
  onFetched?: (polyline: string) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // A flight has no real road/rail path to draw — a straight dashed line
    // reads as "estimated, as the crow flies" rather than a real route,
    // which a solid DirectionsRenderer line would wrongly imply here.
    if (mode === "FLY") {
      const dash = {
        path: "M 0,-1 0,1",
        strokeOpacity: 1,
        scale: 3,
      };
      const polyline = new google.maps.Polyline({
        map,
        path: [
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng },
        ],
        strokeOpacity: 0,
        strokeColor: "#2b6094",
        icons: [{ icon: dash, offset: "0", repeat: "14px" }],
      });
      return () => polyline.setMap(null);
    }

    const key = polylineKey(from, to, mode);
    // A DB-cached line is only trusted if it still starts and ends at these
    // stops — a stop can change place under the same item id (see
    // polylineMatchesEndpoints). "" (no route exists) can't be checked that
    // way and is kept as-is. A stale line falls through to a fresh fetch,
    // which also overwrites the cache.
    const dbLine =
      cachedPolyline === "" ||
      (cachedPolyline && polylineMatchesEndpoints(cachedPolyline, from, to))
        ? cachedPolyline
        : null;
    const known = sessionPolylines.get(key) ?? dbLine;
    let line: google.maps.Polyline | null = null;
    function draw(encoded: string) {
      if (!encoded) return; // "" = no route exists; draw nothing
      line = new google.maps.Polyline({
        map,
        path: decodePolyline(encoded),
        strokeColor: "#2b6094",
        strokeOpacity: 0.85,
        strokeWeight: 4,
      });
    }

    if (known != null) {
      draw(known);
      return () => line?.setMap(null);
    }

    // Not cached anywhere yet — ask Google once, draw it, and hand the
    // line back so it's stored and never requested again for this leg.
    let cancelled = false;
    new google.maps.DirectionsService().route(
      {
        origin: { lat: from.lat, lng: from.lng },
        destination: { lat: to.lat, lng: to.lng },
        travelMode: TRAVEL_MODE_MAP[mode]!,
      },
      (result, status) => {
        let encoded: string | null = null;
        if (status === "OK" && result?.routes[0]?.overview_polyline) {
          encoded = result.routes[0].overview_polyline;
        } else if (status === "ZERO_RESULTS" || status === "NOT_FOUND") {
          encoded = "";
        }
        // Anything else (quota, denied, network) is transient — leave it
        // uncached so a later render can try again.
        if (encoded == null) return;
        sessionPolylines.set(key, encoded);
        onFetched?.(encoded);
        if (!cancelled) draw(encoded);
      }
    );

    return () => {
      cancelled = true;
      line?.setMap(null);
    };
    // onFetched is a fresh closure each render; the leg itself is what
    // should retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, from, to, mode, cachedPolyline]);

  return null;
}

// Replaces the old "pick a center/zoom once on mount" behavior, which left
// the viewport stuck wherever it happened to be after switching days or
// when a day's stops are spread out — some markers ended up off-screen,
// looking like they "weren't nearby" even though they were part of the
// same day. Keyed on id+coordinates (not the array reference, which is
// rebuilt every render) so this re-fits both when the set of stops changes
// AND when an existing stop's position changes (e.g. swapping today's
// anchor hotel to a different address keeps the same item id) — an id-only
// key missed that second case and left the map pointed at the old spot.
// Shared with MobileMapFullscreen's "顯示全部景點" button so both frame a
// day's stops the same way. Returns the one-shot idle listener so callers
// can cancel the zoom cap if they re-fit before it fires.
export function fitMapToItems(
  map: google.maps.Map,
  items: { lat: number; lng: number }[],
  padding: number | google.maps.Padding = 48
) {
  const bounds = new google.maps.LatLngBounds();
  items.forEach((i) => bounds.extend({ lat: i.lat, lng: i.lng }));
  map.fitBounds(bounds, padding);

  // A single stop (or a tight cluster) makes fitBounds zoom all the
  // way in — capping it once the viewport settles avoids a separate
  // branch for "only one item".
  return google.maps.event.addListenerOnce(map, "idle", () => {
    if ((map.getZoom() ?? 0) > 16) map.setZoom(16);
  });
}

export function FitBounds({
  items,
  padding = 48,
}: {
  items: MapItem[];
  padding?: number | google.maps.Padding;
}) {
  const map = useMap();
  const itemsKey = items.map((i) => `${i.id}:${i.lat},${i.lng}`).join(",");

  useEffect(() => {
    if (!map || items.length === 0) return;

    function fit() {
      return fitMapToItems(map!, items, padding);
    }

    let idleListener = fit();

    // The map card can be CSS-hidden (display:none, see TripDayBoard's
    // mobile 時間軸／地圖 toggle) — Google Maps never relayouts tiles or
    // recomputes its viewport on its own for a container that was 0×0
    // when it initialized, so revealing it needs an explicit `resize`
    // trigger plus a re-fit, or it renders blank/mis-framed the first
    // time a mobile user switches to it.
    const container = map.getDiv();
    let wasVisible = container.offsetWidth > 0 && container.offsetHeight > 0;
    const observer = new ResizeObserver(() => {
      const isVisible = container.offsetWidth > 0 && container.offsetHeight > 0;
      if (isVisible && !wasVisible) {
        google.maps.event.trigger(map!, "resize");
        google.maps.event.removeListener(idleListener);
        idleListener = fit();
      }
      wasVisible = isVisible;
    });
    observer.observe(container);

    return () => {
      google.maps.event.removeListener(idleListener);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, itemsKey]);

  return null;
}

function MissingKeyNotice() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded-lg bg-paper-alt px-4 text-center text-xs text-ink-500">
      <p>尚未設定 Google Maps API Key</p>
      <p>請在 .env.local 填入 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 後重啟 dev server</p>
    </div>
  );
}

// The first stop is the day's starting point ("S"), then 1, 2, 3… for the
// rest. Every place that shows a stop number (markers here, the
// full-screen map's cards) must go through this — the markers used to
// compute their own `index + 1` (S, 2, 3…) while the cards used `index`
// (S, 1, 2…), so the two disagreed by one from the second stop on.
export function stopLabel(index: number) {
  return index === 0 ? "S" : String(index);
}

// The day's numbered markers — shared with MobileMapFullscreen so both
// views number and color stops identically.
export function DayMarkers({
  items,
  selectedItemId,
  onSelectItem,
}: {
  items: MapItem[];
  selectedItemId: string | null;
  onSelectItem?: (id: string) => void;
}) {
  return (
    <>
      {items.map((item, index) => {
        const isStart = index === 0;
        const color = isStart
          ? START_MARKER_COLOR
          : TYPE_COLOR[item.type]?.hex ?? TYPE_COLOR.PLACE.hex;
        return (
          <Marker
            key={item.id}
            position={{ lat: item.lat, lng: item.lng }}
            title={item.name}
            icon={buildMarkerIcon(
              stopLabel(index),
              color,
              item.id === selectedItemId
            )}
            // Keeps the selected marker drawn above its neighbours when
            // stops sit close together.
            zIndex={item.id === selectedItemId ? 1000 : undefined}
            onClick={onSelectItem ? () => onSelectItem(item.id) : undefined}
            clickable={!!onSelectItem}
          />
        );
      })}
    </>
  );
}

export function DayRoutes({
  day,
  onRoutePolyline,
}: {
  day: MapDay;
  onRoutePolyline?: RoutePolylineHandler;
}) {
  return (
    <>
      {day.routes.map((route) => {
        const from = day.items.find((i) => i.id === route.fromItemId);
        const to = day.items.find((i) => i.id === route.toItemId);
        if (!from || !to) return null;
        return (
          <RouteSegment
            key={`${route.fromItemId}-${route.toItemId}`}
            from={from}
            to={to}
            mode={route.mode}
            cachedPolyline={route.polyline}
            onFetched={
              onRoutePolyline ? (polyline) => onRoutePolyline(day.id, route, polyline) : undefined
            }
          />
        );
      })}
    </>
  );
}

export default function TripMap({
  apiKey,
  days,
  selectedDayId,
  selectedItemId,
  onSelectItem,
  variant = "panel",
  onExpand,
  onRoutePolyline,
}: {
  apiKey?: string;
  days: MapDay[];
  // Controlled by TripDayBoard's Day Tabs. The map used to carry its own
  // day dropdown as well, which only duplicated the tabs — on mobile the
  // full-screen map (MobileMapFullscreen) has its own day chips instead.
  selectedDayId: string | undefined;
  // "Currently selected" item — set by clicking a marker, or by the
  // timeline card's "定位" button (see TripDayBoard). Drives both the
  // highlighted marker style and the InfoWindow.
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  // "panel" — the desktop sidebar map, fully interactive.
  // "preview" — the mobile in-page map: a static glance at the day that
  // only opens MobileMapFullscreen when tapped. Taking no gestures at all
  // is the point — the old 70vh interactive map on mobile either trapped
  // page scrolling (greedy) or needed two fingers / a lock toggle to pan
  // (cooperative). Panning now only happens in the full-screen view,
  // where there's no page behind it to scroll.
  variant?: "panel" | "preview";
  onExpand?: () => void;
  onRoutePolyline?: RoutePolylineHandler;
}) {
  // Desktop panel only: starts locked (cooperative) so scrolling the page
  // over the map isn't hijacked; the button opts into plain-drag panning.
  // Reset on day switch so it never inherits a stale unlocked state.
  const [mapEngaged, setMapEngaged] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMapEngaged(false);
  }, [selectedDayId]);

  const day = days.find((d) => d.id === selectedDayId) ?? days[0];

  if (!apiKey) {
    return <MissingKeyNotice />;
  }

  if (!day || day.items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-paper-alt text-xs text-ink-500">
        這天還沒有地點可顯示
      </div>
    );
  }

  const center = { lat: day.items[0].lat, lng: day.items[0].lng };

  if (variant === "preview") {
    return (
      <div className="relative h-full overflow-hidden rounded-xl">
        <Map
          style={{ width: "100%", height: "100%" }}
          defaultCenter={center}
          defaultZoom={14}
          gestureHandling="none"
          disableDefaultUI
          keyboardShortcuts={false}
          clickableIcons={false}
        >
          <FitBounds items={day.items} padding={32} />
          <DayMarkers items={day.items} selectedItemId={null} />
          <DayRoutes day={day} onRoutePolyline={onRoutePolyline} />
        </Map>
        {/* Covers the whole map so every touch lands on a plain element:
            a swipe scrolls the page like anywhere else, a tap opens the
            full-screen map. Google's own map div would otherwise still
            swallow the touch even with gestureHandling="none". */}
        <button
          type="button"
          onClick={onExpand}
          aria-label="展開全螢幕地圖"
          className="absolute inset-0 z-10 cursor-pointer"
        >
          <span className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-ink-700 shadow">
            <Maximize2 className="h-4 w-4" />
          </span>
          <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-ink-700 shadow">
            <Hand className="h-3.5 w-3.5" />
            點地圖展開
          </span>
        </button>
      </div>
    );
  }

  // Only ever non-null when the selection belongs to the day actually
  // being shown — switching days makes this (and the InfoWindow/marker
  // highlight below) fall away on its own, no explicit reset needed.
  const selectedItem = day.items.find((i) => i.id === selectedItemId);

  return (
    <div className="relative h-full">
      {/* Lock/unlock toggle — lets someone who actually wants to pan the
          map do it with a plain drag (gestureHandling="greedy") without
          making page scrolling over the map get eaten by default. */}
      <button
        type="button"
        onClick={() => setMapEngaged((prev) => !prev)}
        // bottom-left — Google's default UI (disableDefaultUI={false} below)
        // already occupies the other three corners: map type top-left,
        // fullscreen top-right, zoom + street view pegman bottom-right.
        className={`absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur ${
          mapEngaged
            ? "bg-brand-600 text-white"
            : "bg-white/90 text-ink-700 hover:bg-white"
        }`}
      >
        {mapEngaged ? (
          <>
            <Check className="h-3.5 w-3.5" />
            完成拖曳
          </>
        ) : (
          <>
            <Move className="h-3.5 w-3.5" />
            拖曳地圖
          </>
        )}
      </button>
      <Map
        style={{ width: "100%", height: "100%", borderRadius: 12 }}
        defaultCenter={center}
        defaultZoom={14}
        gestureHandling={mapEngaged ? "greedy" : "cooperative"}
        disableDefaultUI={false}
      >
        <FitBounds items={day.items} />
        <DayMarkers
          items={day.items}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
        />
        <DayRoutes day={day} onRoutePolyline={onRoutePolyline} />

        {selectedItem && (
          <InfoWindow
            position={{ lat: selectedItem.lat, lng: selectedItem.lng }}
            onCloseClick={() => onSelectItem(null)}
          >
            <div className="max-w-[200px] p-1">
              {selectedItem.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedItem.photoUrl}
                  alt={selectedItem.name}
                  className="mb-1.5 h-20 w-full rounded object-cover"
                />
              )}
              <p
                className={`text-sm font-semibold ${
                  TYPE_COLOR[selectedItem.type]?.text ?? TYPE_COLOR.PLACE.text
                }`}
              >
                {selectedItem.name}
              </p>
              {selectedItem.startTime && (
                <p className="text-xs text-ink-500">{formatTime(selectedItem.startTime)}</p>
              )}
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
}
