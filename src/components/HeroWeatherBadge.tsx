"use client";

import { useEffect, useState } from "react";
import { fetchDayWeather } from "@/app/trips/actions";
import { weatherLabel, type DailyWeather } from "@/lib/weather";

export default function HeroWeatherBadge({
  lat,
  lng,
  dateIso,
}: {
  lat: number;
  lng: number;
  dateIso: string;
}) {
  const [weather, setWeather] = useState<DailyWeather | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDayWeather(lat, lng, dateIso).then((result) => {
      if (!cancelled) setWeather(result);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, dateIso]);

  if (!weather) return null;

  const WeatherIcon = weatherLabel(weather.weatherCode).icon;

  return (
    <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">
      <WeatherIcon className="h-3.5 w-3.5" />
      {Math.round(weather.maxTemp)}° / {Math.round(weather.minTemp)}°
    </span>
  );
}
