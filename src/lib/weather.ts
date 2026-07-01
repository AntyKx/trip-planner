export type DailyWeather = {
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
};

const WEATHER_LABEL: Record<number, { emoji: string; label: string }> = {
  0: { emoji: "☀️", label: "晴朗" },
  1: { emoji: "🌤️", label: "大致晴朗" },
  2: { emoji: "⛅", label: "多雲" },
  3: { emoji: "☁️", label: "陰天" },
  45: { emoji: "🌫️", label: "有霧" },
  48: { emoji: "🌫️", label: "有霧" },
  51: { emoji: "🌦️", label: "毛毛雨" },
  53: { emoji: "🌦️", label: "毛毛雨" },
  55: { emoji: "🌦️", label: "毛毛雨" },
  61: { emoji: "🌧️", label: "小雨" },
  63: { emoji: "🌧️", label: "中雨" },
  65: { emoji: "🌧️", label: "大雨" },
  71: { emoji: "🌨️", label: "小雪" },
  73: { emoji: "🌨️", label: "中雪" },
  75: { emoji: "❄️", label: "大雪" },
  80: { emoji: "🌦️", label: "陣雨" },
  81: { emoji: "🌧️", label: "陣雨" },
  82: { emoji: "⛈️", label: "強陣雨" },
  95: { emoji: "⛈️", label: "雷雨" },
  96: { emoji: "⛈️", label: "雷雨" },
  99: { emoji: "⛈️", label: "強雷雨" },
};

export function weatherLabel(code: number) {
  return WEATHER_LABEL[code] ?? { emoji: "🌡️", label: "" };
}

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

    const res = await fetch(url, { next: { revalidate: 3600 } });
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
