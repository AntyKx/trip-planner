import { redirect } from "next/navigation";
import { Camera, Luggage, MapPin, Plane } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import StartJourneyButton from "@/components/StartJourneyButton";

// Real, already-hosted trip photos from this app's own data — used as the
// splash collage imagery instead of custom illustration (no image-gen tool
// available, and guessing stock-photo URLs risks broken/wrong images).
const HERO_PHOTO =
  "https://a9xyigfuupqgvmso.public.blob.vercel-storage.com/21CBF93B-7130-4D45-B299-4AE6BD66E957-vay3S8u3lnSi9odldGe9lJggCgS03D.png"; // 台北101
const SECONDARY_PHOTO =
  "https://places.googleapis.com/v1/places/ChIJ8T1GpMGOGGARDYGSgpooDWw/photos/AaVGc3m-RjVZVn5DfB2KkRbAVIPD_yDb0PuzQNJciJjPoRPXLOcX9lnEdOlRToSYFmEPICnGkXsVlKiVxYUtLvxPbsnfsW6X6dcT8f37cljePblyNcfwQKV9lgUETbNksKVptdnwm5kTemQc0SStjFdPR49hJl0DWG8XWWsqaLa-Evmt0jLygUZp2ZP3SfQmFJY26fm1Ge-LyYgjemT7gZbW71AW9qGrW1B72vD7aQknF0UMtjpd5qWOmkk4vHCL5y6Y9oEMAixduonpsgnN7o3ybjmCYZtzv8IG1wpyx7-ufVOOvw-08sJRGzSpnydoW-KyJEdOgum6XA4PymwM-ATozqAhEGsvk6bdNIkl_xp3iQ489MyXOaAKhgDt-ueehft7dAvekTsL6tIAFykd4SjZ77A-IVWQF7TLlN1P7e4sXAwoVb81/media?key=AIzaSyDzc7zCYaVWmPzr6Px3EanfbTk3VQxL4oo&maxWidthPx=480"; // 淺草寺

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-paper">
      {/* Hero photo */}
      <div className="relative h-[42vh] min-h-[280px] w-full shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_PHOTO}
          alt="台北101"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-paper" />

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 400 300"
          preserveAspectRatio="none"
        >
          <path
            d="M40 60 Q 180 20 260 90 T 360 70"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeDasharray="6 7"
            opacity="0.85"
          />
        </svg>
        <Plane className="absolute right-10 top-10 h-7 w-7 -rotate-12 text-white drop-shadow" />
        <MapPin className="absolute bottom-10 left-8 h-6 w-6 fill-accent-500 text-white drop-shadow" />
      </div>

      {/* Sticky-note tagline, overlapping the hero */}
      <div className="relative -mt-8 px-8">
        <div className="mx-auto w-fit -rotate-2 rounded-sm bg-[#fdf6e3] px-5 py-3 shadow-md ring-1 ring-black/5">
          <p className="font-script text-2xl leading-tight text-ink-900">
            每段旅程，
            <br />
            都是生活的收藏。
          </p>
        </div>
      </div>

      {/* Mini collage: polaroid photo + travel-map card */}
      <div className="mt-6 flex justify-center gap-3 px-8">
        <div className="w-28 rotate-[-3deg] rounded bg-white p-1.5 shadow-md ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SECONDARY_PHOTO}
            alt="淺草寺"
            className="h-20 w-full rounded-sm object-cover"
          />
          <p className="mt-1 text-center text-[10px] text-ink-500">
            Asakusa, Japan
          </p>
        </div>
        <div className="w-28 rotate-2 rounded-lg bg-[#f4efe0] p-2.5 shadow-md ring-1 ring-black/5">
          <div className="flex items-center gap-1 text-brand-700">
            <MapPin className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium">Travel Map</span>
          </div>
          <svg className="mt-1.5 h-16 w-full" viewBox="0 0 100 60">
            <circle cx="15" cy="45" r="3" fill="#2b6094" />
            <circle cx="55" cy="15" r="3" fill="#2b6094" />
            <circle cx="85" cy="35" r="3" fill="#b45309" />
            <path
              d="M15 45 L55 15 L85 35"
              fill="none"
              stroke="#2b6094"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          </svg>
        </div>
      </div>

      {/* Wordmark */}
      <div className="mt-8 px-6 text-center">
        <h1 className="font-script text-6xl leading-none text-brand-700">
          Trip Planner
        </h1>
        <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-accent-500" />
        <p className="mt-4 text-sm text-ink-500">
          你的旅行手帳與行程規劃助手
        </p>
      </div>

      <div className="flex-1" />

      {/* CTA */}
      <div className="px-6 pb-10 pt-8">
        <StartJourneyButton />
        <div className="mt-5 flex items-center justify-center gap-6 text-ink-500/60">
          <Luggage className="h-6 w-6" />
          <Camera className="h-6 w-6" />
        </div>
      </div>
    </main>
  );
}
