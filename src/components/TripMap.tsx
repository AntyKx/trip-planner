"use client";

import { useEffect } from "react";
import { Map, Marker, InfoWindow, useMap } from "@vis.gl/react-google-maps";
import { TYPE_COLOR, formatTime } from "@/lib/labels";

const START_MARKER_COLOR = "#b45309";

// Builds a small colored-circle SVG data-URI icon so markers aren't Google's
// default red pin. Uses plain objects (not `new google.maps.Size/Point`) so
// this can run during React's render phase before the Maps script has
// necessarily finished loading — the Icon type is only used for annotation.
// `highlighted` bumps the size and stroke so the currently-selected item
// (clicked on the map or "located" from a timeline card) stands out.
function buildMarkerIcon(
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
  mode: "WALK" | "TRANSIT" | "DRIVE" | "BIKE";
};

export type MapDay = {
  id: string;
  dayIndex: number;
  items: MapItem[];
  routes: MapRoute[];
};

const TRAVEL_MODE_MAP: Record<MapRoute["mode"], google.maps.TravelMode> = {
  WALK: "WALKING" as google.maps.TravelMode,
  TRANSIT: "TRANSIT" as google.maps.TravelMode,
  DRIVE: "DRIVING" as google.maps.TravelMode,
  BIKE: "BICYCLING" as google.maps.TravelMode,
};

function RouteSegment({
  from,
  to,
  mode,
}: {
  from: MapItem;
  to: MapItem;
  mode: MapRoute["mode"];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const directionsService = new google.maps.DirectionsService();
    const renderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: { strokeColor: "#2b6094", strokeWeight: 4 },
    });

    directionsService.route(
      {
        origin: { lat: from.lat, lng: from.lng },
        destination: { lat: to.lat, lng: to.lng },
        travelMode: TRAVEL_MODE_MAP[mode],
      },
      (result, status) => {
        if (status === "OK" && result) {
          renderer.setDirections(result);
        }
      }
    );

    return () => renderer.setMap(null);
  }, [map, from, to, mode]);

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
function FitBounds({ items }: { items: MapItem[] }) {
  const map = useMap();
  const itemsKey = items.map((i) => `${i.id}:${i.lat},${i.lng}`).join(",");

  useEffect(() => {
    if (!map || items.length === 0) return;

    function fit() {
      const bounds = new google.maps.LatLngBounds();
      items.forEach((i) => bounds.extend({ lat: i.lat, lng: i.lng }));
      map!.fitBounds(bounds, 48);

      // A single stop (or a tight cluster) makes fitBounds zoom all the
      // way in — capping it once the viewport settles avoids a separate
      // branch for "only one item".
      return google.maps.event.addListenerOnce(map!, "idle", () => {
        if ((map!.getZoom() ?? 0) > 16) map!.setZoom(16);
      });
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

export default function TripMap({
  apiKey,
  days,
  selectedDayId,
  onSelectDay,
  selectedItemId,
  onSelectItem,
}: {
  apiKey?: string;
  days: MapDay[];
  // Controlled, not local state — this used to be an internal useState,
  // but that let the map's own day dropdown drift out of sync with the
  // main Day Tabs above the timeline (switch day in the map, flip back to
  // the timeline, and it'd still show the old day). Driven by the same
  // selectedDayId/setSelectedDayId TripDayBoard already uses for the tabs,
  // same pattern as selectedItemId/onSelectItem below.
  selectedDayId: string | undefined;
  onSelectDay: (id: string) => void;
  // "Currently selected" item — set by clicking a marker, or by the
  // timeline card's "定位" button (see TripDayBoard). Drives both the
  // highlighted marker style and the InfoWindow.
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
}) {
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
  // Only ever non-null when the selection belongs to the day actually
  // being shown — switching days makes this (and the InfoWindow/marker
  // highlight below) fall away on its own, no explicit reset needed.
  const selectedItem = day.items.find((i) => i.id === selectedItemId);

  return (
    <div className="flex h-full flex-col">
      {days.length > 1 && (
        <select
          value={selectedDayId}
          onChange={(e) => onSelectDay(e.target.value)}
          className="mb-2 w-full shrink-0 rounded-md border border-line px-2 py-1 text-sm"
        >
          {days.map((d) => (
            <option key={d.id} value={d.id}>
              Day {d.dayIndex}
            </option>
          ))}
        </select>
      )}

      <div className="min-h-0 flex-1">
      <Map
        style={{ width: "100%", height: "100%", borderRadius: 12 }}
        defaultCenter={center}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI={false}
      >
        <FitBounds items={day.items} />

        {day.items.map((item, index) => {
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
                isStart ? "S" : String(index + 1),
                color,
                item.id === selectedItemId
              )}
              onClick={() => onSelectItem(item.id)}
            />
          );
        })}

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
            />
          );
        })}

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
    </div>
  );
}
