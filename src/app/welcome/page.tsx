import { redirect } from "next/navigation";
import { BookOpen, MapPin, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import StartJourneyButton from "@/components/StartJourneyButton";

// Real, already-hosted trip photos from this app's own data — used as the
// splash collage imagery instead of custom illustration (no image-gen tool
// available, and guessing stock-photo URLs risks broken/wrong images).
const HERO_PHOTO =
  "https://a9xyigfuupqgvmso.public.blob.vercel-storage.com/21CBF93B-7130-4D45-B299-4AE6BD66E957-vay3S8u3lnSi9odldGe9lJggCgS03D.png"; // 台北101
export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  // 2026-10-01 restyle (B direction): one full-bleed photo, the brand
  // name, a plain description of what the app does and the CTA. Replaced
  // the scrapbook collage (tilted polaroids, sticky note, dashed route,
  // handwritten wordmark), which read as AI-generated.
  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-paper">
      <div className="relative h-[46vh] min-h-[280px] w-full shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_PHOTO}
          alt="台北101"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      </div>

      <div className="flex flex-1 flex-col px-6 pt-7">
        <h1 className="text-[34px] font-black leading-tight text-brand-600">Trip Planner</h1>
        <p className="mt-2 text-base text-ink-700">排行程、算交通、寫旅遊書，和同行的人一起編輯。</p>

        <ul className="mt-6 space-y-3.5">
          {[
            { icon: MapPin, title: "每天的行程與地圖", desc: "加景點、自動排時間，交通時間一起算好" },
            { icon: Users, title: "和朋友一起規劃", desc: "分享連結，同一份行程大家都能改" },
            { icon: BookOpen, title: "旅行後的旅遊書", desc: "遊記和照片整理成一本，可以公開分享" },
          ].map(({ icon: Icon, title, desc }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold text-ink-900">{title}</span>
                <span className="block text-sm text-ink-500">{desc}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="flex-1" />
        <div className="pb-10 pt-8">
          <StartJourneyButton />
        </div>
      </div>
    </main>
  );
}
