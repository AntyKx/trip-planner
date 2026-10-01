"use client";

import { useEffect, useState } from "react";

// Brand splash: the app's own PWA icon (the one on the home screen) on a
// white screen, settling in and fading out to the white home page.
// Replaced (2026-10-01) the 11 AI-drawn city illustrations with a
// handwritten "Trip Planner" + slogan baked into each image — the most
// AI-looking thing left after the restyle. The user asked to reuse the
// icon they were happy with. /icons/splash-icon.webp is a 384px resize of
// icon-512.png (crisp at this size on 3x screens without loading the 550KB
// original). No random pick any more, so server and client render the
// same markup (the old random image caused a hydration mismatch).
const HOLD_MS = 750;
const EXIT_MS = 300;

type Phase = "enter" | "hold" | "exit" | "gone";

// Mounted once in the root layout — App Router doesn't remount a shared
// layout on client-side navigation between pages, so this only ever plays
// on an actual cold load (refresh, PWA launch, first visit), not every
// time the user taps between trips.
export default function SplashScreen() {
  const [phase, setPhase] = useState<Phase>("enter");

  useEffect(() => {
    // "enter" renders the icon slightly small and transparent so there's
    // a starting state to animate from; flipping to "hold" a frame later
    // lets it settle in instead of snapping.
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
      className={`pointer-events-none fixed inset-0 z-[var(--z-critical)] flex items-center justify-center bg-paper transition-opacity ease-out motion-reduce:transition-none ${
        phase === "exit" ? "opacity-0 duration-300" : "opacity-100 duration-0"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/splash-icon.webp"
        alt=""
        width={128}
        height={128}
        className={`h-32 w-32 rounded-[28px] shadow-[0_8px_24px_rgba(20,23,26,0.14)] transition duration-500 ease-out motion-reduce:transition-none ${
          phase === "enter" ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      />
    </div>
  );
}
