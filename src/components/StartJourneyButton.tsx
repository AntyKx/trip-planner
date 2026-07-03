"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

const SPLASH_SEEN_COOKIE_NAME = "tp_seen_splash";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export default function StartJourneyButton() {
  const router = useRouter();

  function handleClick() {
    document.cookie = `${SPLASH_SEEN_COOKIE_NAME}=1; path=/; max-age=${ONE_YEAR_SECONDS}`;
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-900/20 hover:bg-brand-700"
    >
      開始旅程
      <ArrowRight className="h-5 w-5" />
    </button>
  );
}
