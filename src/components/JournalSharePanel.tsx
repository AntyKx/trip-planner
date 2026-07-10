"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Copy, Check, Eye } from "lucide-react";
import { enableJournalShare, disableJournalShare } from "@/app/trips/actions";
import AppCard from "./AppCard";
import { useToast } from "./Toast";

export default function JournalSharePanel({
  tripId,
  canManage,
  journalShareEnabled,
  journalShareToken,
}: {
  tripId: string;
  canManage: boolean;
  journalShareEnabled: boolean;
  journalShareToken: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const journalUrl =
    journalShareEnabled && journalShareToken && typeof window !== "undefined"
      ? `${window.location.origin}/journal/${journalShareToken}`
      : "";

  function handleEnable() {
    setCopied(false);
    startTransition(async () => {
      await enableJournalShare(tripId);
      toast.success("已開啟旅遊書分享連結");
      router.refresh();
    });
  }

  function handleDisable() {
    setCopied(false);
    startTransition(async () => {
      await disableJournalShare(tripId);
      toast.success("已關閉旅遊書分享連結");
      router.refresh();
    });
  }

  async function handleCopyLink() {
    if (!journalUrl) return;
    await navigator.clipboard.writeText(journalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!canManage) return null;

  return (
    <AppCard className="p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
        <BookOpen className="h-4 w-4" />
        旅遊書分享
      </h3>
      <p className="mt-1 text-xs text-ink-500">
        把有寫遊記或上傳照片的景點整理成一頁可分享的旅遊書，任何拿到連結的人都能看，不需要登入帳號。
      </p>

      <Link
        href={`/trips/${tripId}/journal`}
        className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
      >
        <Eye className="h-3.5 w-3.5" />
        預覽旅遊書（不需要先開啟分享）
      </Link>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-700">公開連結</span>
        <button
          type="button"
          disabled={isPending}
          onClick={journalShareEnabled ? handleDisable : handleEnable}
          className={`rounded-md px-2.5 py-1 text-xs disabled:opacity-50 ${
            journalShareEnabled
              ? "border border-line text-ink-700 hover:bg-paper-alt"
              : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {journalShareEnabled ? "關閉分享" : "開啟分享連結"}
        </button>
      </div>

      {journalShareEnabled && (
        <div className="mt-2 flex items-center gap-2">
          <input
            readOnly
            value={journalUrl}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-md border border-line bg-paper-alt px-2 py-1 text-xs text-ink-700"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-xs hover:bg-paper-alt"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "已複製" : "複製"}
          </button>
        </div>
      )}
    </AppCard>
  );
}
