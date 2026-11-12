import Link from "next/link";
import { MapPinOff } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { appButtonClassName } from "@/components/AppButton";

// Shown for unknown URLs and for notFound() calls (e.g. a deleted trip or a
// share link that was turned off) — instead of Next.js's default English page.
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16 sm:px-6">
      <EmptyState
        icon={MapPinOff}
        title="找不到這個頁面"
        description="行程可能已被刪除，或分享連結已關閉。"
        action={
          <Link href="/" className={appButtonClassName("primary", "md", "mt-1")}>
            回首頁
          </Link>
        }
      />
    </main>
  );
}
