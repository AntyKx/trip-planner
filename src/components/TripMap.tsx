"use client";

import { useEffect, useState } from "react";
import { Map, Marker, useMap } from "@vis.gl/react-google-maps";

export type MapItem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
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
      polylineOptions: { strokeColor: "#4f46e5", strokeWeight: 4 },
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
    <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 px-4 text-center text-xs text-slate-600">
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
      <div className="flex h-64 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-600">
        這天還沒有地點可顯示
      </div>
    );
  }

  const center = { lat: day.items[0].lat, lng: day.items[0].lng };

  return (
    <div>
      {days.length > 1 && (
        <select
          value={selectedDayId}
          onChange={(e) => setSelectedDayId(e.target.value)}
          className="mb-2 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
        >
          {days.map((d) => (
            <option key={d.id} value={d.id}>
              Day {d.dayIndex}
            </option>
          ))}
        </select>
      )}

      <Map
        style={{ width: "100%", height: 320, borderRadius: 12 }}
        defaultCenter={center}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI={false}
      >
        {day.items.map((item, index) => (
          <Marker
            key={item.id}
            position={{ lat: item.lat, lng: item.lng }}
            title={item.name}
            label={String(index + 1)}
          />
        ))}

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
  );
}
