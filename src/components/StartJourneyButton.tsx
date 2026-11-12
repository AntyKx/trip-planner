"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { appButtonClassName } from "./AppButton";

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
      className={appButtonClassName("primary", "lg", "w-full")}
    >
      開始旅程
      <ArrowRight className="h-5 w-5" />
    </button>
  );
}
