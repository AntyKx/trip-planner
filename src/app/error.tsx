"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CloudOff } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { appButtonClassName } from "@/components/AppButton";

// Route-level error boundary — replaces Next.js's default English error
// screen with one that matches the app and offers a retry.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16 sm:px-6">
      <EmptyState
        icon={CloudOff}
        title="頁面載入失敗"
        description="可能是網路不穩，請再試一次。"
        action={
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className={appButtonClassName("primary", "md")}
            >
              再試一次
            </button>
            <Link href="/" className={appButtonClassName("secondary", "md")}>
              回首頁
            </Link>
          </div>
        }
      />
    </main>
  );
}
