"use client";

import { useEffect, useState } from "react";
import { Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { TYPE_COLOR } from "@/lib/labels";

const START_MARKER_COLOR = "#b45309";

// Builds a small colored-circle SVG data-URI icon so markers aren't Google's
// default red pin. Uses plain objects (not `new google.maps.Size/Point`) so
// this can run during React's render phase before the Maps script has
// necessarily finished loading — the Icon type is only used for annotation.
function buildMarkerIcon(label: string, hexColor: string): google.maps.Icon {
  const size = 30;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${
    size / 2
  }" cy="${size / 2}" r="${
    size / 2 - 1.5
  }" fill="${hexColor}" stroke="white" stroke-width="2"/><text x="${size / 2}" y="${
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
}: {
  apiKey?: string;
  days: MapDay[];
}) {
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id);
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

  return (
    <div className="flex h-full flex-col">
      {days.length > 1 && (
        <select
          value={selectedDayId}
          onChange={(e) => setSelectedDayId(e.target.value)}
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
              icon={buildMarkerIcon(isStart ? "S" : String(index + 1), color)}
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
      </Map>
      </div>
    </div>
  );
}
