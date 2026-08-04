"use client";

import { useEffect, useState } from "react";

// Same 10 cities, two aspect ratios — public/splash/*.webp is the portrait
// artwork drawn for a phone screen, public/splash/wide/*.webp is a
// separately-drawn full-bleed landscape version for desktop (the portrait
// one crops its own "Trip Planner" wordmark off on a wide viewport, since
// object-cover has no way to know that text needs to stay in frame).
// Index-matched to the same city, picked once so both variants always
// agree on which city is showing regardless of viewport.
const CITY_FILES = [
  "01-tokyo.webp",
  "02-hokkaido.webp",
  "03-taipei.webp",
  "04-fukuoka.webp",
  "05-osaka.webp",
  "06-paris.webp",
  "07-spain.webp",
  "08-sydney.webp",
  "09-london.webp",
  "10-newyork.webp",
];

const HOLD_MS = 1450;
const EXIT_MS = 600;

type Phase = "enter" | "hold" | "exit" | "gone";

// Mounted once in the root layout — App Router doesn't remount a shared
// layout on client-side navigation between pages, so this only ever plays
// on an actual cold load (refresh, PWA launch, first visit), not every
// time the user taps between trips.
export default function SplashScreen() {
  const [file] = useState(
    () => CITY_FILES[Math.floor(Math.random() * CITY_FILES.length)]
  );
  const [phase, setPhase] = useState<Phase>("enter");

  useEffect(() => {
    // Starts in "enter" (image scaled up slightly) so there's an actual
    // starting state to settle from — flipping to "hold" a frame later is
    // what makes that settle visibly animate instead of snapping straight
    // to rest.
    const raf = requestAnimationFrame(() => setPhase("hold"));
    const exitTimer = setTimeout(() => setPhase("exit"), HOLD_MS);
    const goneTimer = setTimeout(() => setPhase("gone"), HOLD_MS + EXIT_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(exitTimer);
      clearTimeout(goneTimer);
    };
  }, []);

  if (phase === "gone") return null;

  const imgClassName = `h-full w-full object-cover transition-transform duration-[1400ms] ease-out motion-reduce:transition-none ${
    phase === "enter" ? "scale-105" : "scale-100"
  }`;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[var(--z-critical)] overflow-hidden bg-paper transition-opacity motion-reduce:transition-none ${
        phase === "exit"
          ? "opacity-0 duration-500 ease-in"
          : "opacity-100 duration-700 ease-out"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/splash/${file}`} alt="" className={`sm:hidden ${imgClassName}`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/splash/wide/${file}`}
        alt=""
        className={`hidden sm:block ${imgClassName}`}
      />
      {/* Light sweep across the artwork while it holds — only during
          "hold" so it never plays partway through the fade-out. */}
      {phase === "hold" && (
        <div
          aria-hidden="true"
          className="animate-splash-sheen motion-reduce:hidden pointer-events-none absolute inset-0 mix-blend-soft-light"
          style={{
            background:
              "linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)",
            backgroundSize: "250% 250%",
          }}
        />
      )}
    </div>
  );
}
