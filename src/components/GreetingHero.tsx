"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour: number): string {
  if (hour < 5) return "夜深了";
  if (hour < 12) return "早安";
  if (hour < 18) return "午安";
  return "晚安";
}

// Client component on purpose — the greeting depends on local time of day,
// and this app's server runs in UTC (see project_perf_trip_page memory).
// Computing "早安/午安/晚安" from server hours would be wrong for most
// users most of the time (e.g. 3pm in Taiwan is 7am UTC). Renders a
// neutral placeholder on the server/first paint, then swaps in the real
// greeting once mounted in the browser.
export default function GreetingHero({ name }: { name: string }) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-ink-900 sm:text-4xl">
        {greeting ?? "哈囉"}，{name}
      </h1>
      <p className="mt-1 text-sm text-ink-500">下一段旅程，從這裡開始</p>
    </div>
  );
}
