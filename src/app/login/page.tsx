import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";

// Same real-photo approach as the welcome screen — see src/app/welcome/page.tsx.
const HERO_PHOTO =
  "https://a9xyigfuupqgvmso.public.blob.vercel-storage.com/02C9B644-CB3C-4F42-AFB6-50C0954BE1C0-mWqNYqlZX3IS8b5LT403SxmFfQfz4q.png"; // 福岡7日：夜櫻與天際線
// Only a same-origin relative path is ever honored — "next" is untrusted
// client-controlled input (a query param), so this guards against being
// used as an open redirect to an external site (e.g. "//evil.com").
function safeNextPath(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getCurrentUser();
  if (user) redirect(nextPath);

  // 2026-10-01 restyle (B direction): photo, brand, one line, the
  // sign-in button — the polaroid/icon-bubble collage and accent underline
  // are gone (see welcome/page.tsx).
  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-paper">
      <div className="relative h-[40vh] min-h-[240px] w-full shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_PHOTO}
          alt="福岡夜櫻"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pt-7">
        <p className="text-sm font-bold text-brand-600">Trip Planner</p>
        <h1 className="mt-1 text-[28px] font-black text-ink-900">歡迎回來</h1>
        <p className="mt-1.5 text-sm text-ink-500">用 Google 帳號登入，行程會在你的每台裝置同步。</p>
        <div className="mt-7">
          <GoogleSignInButton next={nextPath} />
        </div>
      </div>
    </main>
  );
}
