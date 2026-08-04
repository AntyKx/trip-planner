"use client";

import { useEffect, useState } from "react";

// One per city in public/splash/ — WebP, ~90-125KB each, and only one is
// ever fetched per app open. Picked client-side (not in the server
// component layout) so this is genuinely different per browser session —
// a server-side Math.random() risks Next.js caching that one render into
// a shared static shell and serving the same picture to everyone.
const SPLASH_IMAGES = [
  "/splash/01-tokyo.webp",
  "/splash/02-hokkaido.webp",
  "/splash/03-taipei.webp",
  "/splash/04-fukuoka.webp",
  "/splash/05-osaka.webp",
  "/splash/06-paris.webp",
  "/splash/07-spain.webp",
  "/splash/08-sydney.webp",
  "/splash/09-london.webp",
  "/splash/10-newyork.webp",
];

const HOLD_MS = 1450;
const EXIT_MS = 600;

type Phase = "enter" | "hold" | "exit" | "gone";

// Mounted once in the root layout — App Router doesn't remount a shared
// layout on client-side navigation between pages, so this only ever plays
// on an actual cold load (refresh, PWA launch, first visit), not every
// time the user taps between trips.
export default function SplashScreen() {
  const [src] = useState(
    () => SPLASH_IMAGES[Math.floor(Math.random() * SPLASH_IMAGES.length)]
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

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[var(--z-critical)] overflow-hidden bg-paper transition-opacity motion-reduce:transition-none ${
        phase === "exit"
          ? "opacity-0 duration-500 ease-in"
          : "opacity-100 duration-700 ease-out"
      }`}
    >
      {/* The artwork is drawn for a phone's portrait screen (its own
          "Trip Planner" wordmark sits near the top). Letting object-cover
          fill a wide desktop viewport directly crops that wordmark clean
          off — capping the width to a phone-ish column and letterboxing
          the rest keeps the whole design intact on any screen instead of
          only looking right on the one aspect ratio it was drawn for. */}
      <div className="relative mx-auto h-full w-full max-w-md overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className={`h-full w-full object-cover transition-transform duration-[1400ms] ease-out motion-reduce:transition-none ${
            phase === "enter" ? "scale-105" : "scale-100"
          }`}
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
    </div>
  );
}
