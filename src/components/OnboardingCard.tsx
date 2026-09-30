"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { appButtonClassName } from "./AppButton";

// Read server-side by the home page (src/app/page.tsx) so a skipped card
// never renders at all — no flash of the card before a client-side check
// could hide it.
export const ONBOARDING_SKIP_COOKIE = "tp_onboarding_skipped";

export type OnboardingStep = {
  title: string;
  desc: string;
  // What the rest of the app can do once this step is done — folded in
  // here instead of a separate "功能亮點" section (decided with the user
  // when merging the empty-home variants, 2026-09-30).
  feature?: string;
  done: boolean;
  href: string;
  cta: string;
};

// "三步驟開始你的旅行手帳" — each step is ticked from the user's real data
// (has a trip / has any stop / has a companion or share link), so someone
// who created a trip and left comes back to the right step. Disappears on
// its own when all three are done; 略過 is for solo travellers who will
// never do step 3.
export default function OnboardingCard({ steps }: { steps: OnboardingStep[] }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const nextIndex = steps.findIndex((s) => !s.done);

  function skip() {
    // A year is plenty — this only ever hides a nudge, nothing else reads it.
    document.cookie = `${ONBOARDING_SKIP_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    setHidden(true);
  }

  return (
    <div className="animate-fade-up rounded-card-lg border border-line bg-surface p-4 shadow-soft [animation-fill-mode:forwards]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink-900">三步驟開始你的旅行手帳</h2>
          <p className="mt-0.5 text-xs text-ink-500 tabular-nums">已完成 {doneCount} / 3</p>
        </div>
        <button
          type="button"
          onClick={skip}
          className="min-h-9 shrink-0 px-1 text-xs text-ink-500 hover:text-ink-700"
        >
          略過
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-alt">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <ol className="mt-2">
        {steps.map((step, i) => {
          const isNext = i === nextIndex;
          return (
            <li
              key={step.title}
              className={`flex items-start gap-3 py-2.5 ${!step.done && !isNext ? "opacity-55" : ""}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  step.done
                    ? "border-success-700 bg-success-700 text-white"
                    : isNext
                      ? "border-brand-600 text-brand-600"
                      : "border-line-strong text-ink-500"
                }`}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-medium ${
                    step.done ? "text-ink-500 line-through" : "text-ink-900"
                  }`}
                >
                  {step.title}
                </span>
                {!step.done && (
                  <>
                    <span className="mt-0.5 block text-xs text-ink-500">{step.desc}</span>
                    {step.feature && (
                      <span className="mt-1 flex items-start gap-1 text-[11.5px] text-accent-600">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
                        {step.feature}
                      </span>
                    )}
                  </>
                )}
              </span>
              {isNext && (
                <Link href={step.href} className={appButtonClassName("primary", "sm")}>
                  {step.cta}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
