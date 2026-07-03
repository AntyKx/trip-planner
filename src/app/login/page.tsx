import { redirect } from "next/navigation";
import { Luggage, MapPin, Camera } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";

// Same real-photo approach as the welcome screen — see src/app/welcome/page.tsx.
const HERO_PHOTO =
  "https://a9xyigfuupqgvmso.public.blob.vercel-storage.com/02C9B644-CB3C-4F42-AFB6-50C0954BE1C0-mWqNYqlZX3IS8b5LT403SxmFfQfz4q.png"; // 福岡7日：夜櫻與天際線
const POLAROID_PHOTO =
  "https://places.googleapis.com/v1/places/ChIJSTLZ6barQjQRMdkCqrP3CNU/photos/AaVGc3m3tgWd6gIilsT8TjxXEa6LFkWmDV8ffhtlW5psRjJS2OF2YIYI-eD9A0spdXCgDFJcvM1G5WBXTW9m4J8exYebDE5laG3dfJpWZVPHY9xh9OJ_NpP1LLCm4mvpzlMI7PwUNJf2AZCKDA3UPW_ZQK9oQnz8hRTAMRFtv6qlB__ug_vp7TtmVJf9YNx8MjFDnkihXknbIyk4OJgwJYkFYbRMwG9QtWnmnKczepR09-yNWpMNwCZ1WMQkb21-yOmVwv9uQCMoRGLWbDH2G2ds4HrLPgHPXxmSglu7ekZicEDOeF6FgyG1eDMUHvkbk7CU8IgtomapcOnZVh2pfJ8cklxUjrN7os7Sxy49ywxJLbS5xT65uk0KQ_NdYb6rJ620Z8NeiLKqo6Ohn2pYQGThw9qtlqKLy204zoJ5Anrb89b4bsZh/media?key=AIzaSyDzc7zCYaVWmPzr6Px3EanfbTk3VQxL4oo&maxWidthPx=480"; // 台北101觀景台

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-paper">
      {/* Hero photo */}
      <div className="relative h-[34vh] min-h-[220px] w-full shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_PHOTO}
          alt="福岡夜櫻"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-paper" />
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 400 260"
          preserveAspectRatio="none"
        >
          <path
            d="M30 50 Q 150 100 220 40 T 370 60"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeDasharray="6 7"
            opacity="0.85"
          />
        </svg>
        <MapPin className="absolute right-10 top-8 h-6 w-6 fill-accent-500 text-white drop-shadow" />
      </div>

      {/* Mini collage overlapping the hero */}
      <div className="relative -mt-8 flex items-end justify-center gap-3 px-8">
        <div className="w-24 -rotate-3 rounded bg-white p-1.5 shadow-md ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={POLAROID_PHOTO}
            alt="台北101"
            className="h-16 w-full rounded-sm object-cover"
          />
          <p className="mt-1 text-center text-[9px] text-ink-500">Taipei 101</p>
        </div>
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 shadow-md ring-1 ring-black/5">
          <Luggage className="h-6 w-6 text-brand-600" />
        </div>
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 shadow-md ring-1 ring-black/5">
          <Camera className="h-6 w-6 text-accent-600" />
        </div>
      </div>

      {/* Heading */}
      <div className="mt-6 px-6 text-center">
        <h1 className="text-3xl font-bold text-ink-900">歡迎回來</h1>
        <div className="mx-auto mt-1.5 h-1 w-16 rounded-full bg-accent-500" />
        <p className="mt-3 text-sm text-ink-500">登入以同步你的旅程</p>
      </div>

      {/* Sign-in card */}
      <div className="px-6 pb-10 pt-8 sm:mt-6">
        <div className="mx-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <GoogleSignInButton />
          <p className="mt-4 text-center text-xs text-ink-500">
            只有你自己看得到你的行程
          </p>
        </div>
      </div>
    </main>
  );
}
