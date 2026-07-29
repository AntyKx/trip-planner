import type { LucideIcon } from "lucide-react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Snowflake,
  Thermometer,
  ThermometerSun,
  ThermometerSnowflake,
} from "lucide-react";

export type DailyWeather = {
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
};

// Icons (not emoji — rendered inconsistently across platforms and clashed
// with the rest of the app's lucide-based icon language) keyed by Open-Meteo
// WMO weather codes.
const WEATHER_LABEL: Record<number, { icon: LucideIcon; label: string }> = {
  0: { icon: Sun, label: "晴朗" },
  1: { icon: CloudSun, label: "大致晴朗" },
  2: { icon: CloudSun, label: "多雲" },
  3: { icon: Cloud, label: "陰天" },
  45: { icon: CloudFog, label: "有霧" },
  48: { icon: CloudFog, label: "有霧" },
  51: { icon: CloudDrizzle, label: "毛毛雨" },
  53: { icon: CloudDrizzle, label: "毛毛雨" },
  55: { icon: CloudDrizzle, label: "毛毛雨" },
  61: { icon: CloudRain, label: "小雨" },
  63: { icon: CloudRain, label: "中雨" },
  65: { icon: CloudRain, label: "大雨" },
  71: { icon: CloudSnow, label: "小雪" },
  73: { icon: CloudSnow, label: "中雪" },
  75: { icon: Snowflake, label: "大雪" },
  80: { icon: CloudDrizzle, label: "陣雨" },
  81: { icon: CloudRain, label: "陣雨" },
  82: { icon: CloudLightning, label: "強陣雨" },
  95: { icon: CloudLightning, label: "雷雨" },
  96: { icon: CloudLightning, label: "雷雨" },
  99: { icon: CloudLightning, label: "強雷雨" },
};

export function weatherLabel(code: number) {
  return WEATHER_LABEL[code] ?? { icon: Thermometer, label: "" };
}

const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75]);
const HOT_THRESHOLD_C = 30;
const COLD_THRESHOLD_C = 10;

export type WeatherReminder = { icon: LucideIcon; text: string };

// Turns raw weather data into short, actionable reminders instead of just
// a temperature readout — a day can trigger more than one (e.g. hot AND
// rainy), so this returns a list. Icon + text kept separate (not baked into
// the string as emoji) for the same reason as WEATHER_LABEL above — lets
// each caller render it consistently with the rest of the app's lucide
// icons instead of relying on the device's own emoji font.
export function getWeatherReminders(weather: DailyWeather): WeatherReminder[] {
  const reminders: WeatherReminder[] = [];

  if (RAIN_CODES.has(weather.weatherCode)) {
    reminders.push({ icon: CloudRain, text: "記得帶傘，可以安排室內備案" });
  }
  if (SNOW_CODES.has(weather.weatherCode)) {
    reminders.push({ icon: Snowflake, text: "有降雪，注意保暖與交通狀況" });
  }
  if (weather.maxTemp >= HOT_THRESHOLD_C) {
    reminders.push({ icon: ThermometerSun, text: "氣溫偏高，記得補水，戶外景點避開中午" });
  }
  if (weather.minTemp <= COLD_THRESHOLD_C) {
    reminders.push({ icon: ThermometerSnowflake, text: "氣溫偏低，記得保暖" });
  }

  return reminders;
}

export const WEATHER_UNAVAILABLE_MESSAGE =
  "目前太早，天氣資料要出發前才能查詢";

// Open-Meteo requires no API key and only serves forecasts within roughly
// the next 16 days, so trips outside that window simply get no weather.
export async function getDailyWeather(
  lat: number,
  lng: number,
  date: Date
): Promise<DailyWeather | null> {
  const dateStr = date.toISOString().slice(0, 10);

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lng.toString());
    url.searchParams.set("daily", "weathercode,temperature_2m_max,temperature_2m_min");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("start_date", dateStr);
    url.searchParams.set("end_date", dateStr);

    // Open-Meteo has no SLA; without a timeout, one slow/unresponsive call
    // would block the whole trip page (all days are fetched in parallel,
    // so the page waits for the slowest one) instead of just skipping
    // weather for that day.
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const weatherCode = data.daily?.weathercode?.[0];
    const maxTemp = data.daily?.temperature_2m_max?.[0];
    const minTemp = data.daily?.temperature_2m_min?.[0];

    if (weatherCode == null || maxTemp == null || minTemp == null) return null;

    return { weatherCode, maxTemp, minTemp };
  } catch {
    return null;
  }
}
