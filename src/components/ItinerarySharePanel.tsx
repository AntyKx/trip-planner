"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Map, Copy, Check, Eye } from "lucide-react";
import { enableItineraryShare, disableItineraryShare } from "@/app/trips/actions";
import AppCard from "./AppCard";
import { useToast } from "./Toast";

export default function ItinerarySharePanel({
  tripId,
  canManage,
  itineraryShareEnabled,
  itineraryShareToken,
}: {
  tripId: string;
  canManage: boolean;
  itineraryShareEnabled: boolean;
  itineraryShareToken: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const itineraryUrl =
    itineraryShareEnabled && itineraryShareToken && typeof window !== "undefined"
      ? `${window.location.origin}/itinerary/${itineraryShareToken}`
      : "";

  function handleEnable() {
    setCopied(false);
    startTransition(async () => {
      await enableItineraryShare(tripId);
      toast.success("已開啟行程總覽分享連結");
      router.refresh();
    });
  }

  function handleDisable() {
    setCopied(false);
    startTransition(async () => {
      await disableItineraryShare(tripId);
      toast.success("已關閉行程總覽分享連結");
      router.refresh();
    });
  }

  async function handleCopyLink() {
    if (!itineraryUrl) return;
    await navigator.clipboard.writeText(itineraryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!canManage) return null;

  return (
    <AppCard className="p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
        <Map className="h-4 w-4" />
        行程總覽分享
      </h3>
      <p className="mt-1 text-xs text-ink-500">
        把每天的景點、時間、交通方式整理成一頁可分享的行程總覽，讓還沒安裝APP的親友也能看，不含訂房確認碼與花費金額。
      </p>

      <Link
        href={`/trips/${tripId}/itinerary`}
        className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
      >
        <Eye className="h-3.5 w-3.5" />
        預覽行程總覽（不需要先開啟分享）
      </Link>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-700">公開連結</span>
        <button
          type="button"
          disabled={isPending}
          onClick={itineraryShareEnabled ? handleDisable : handleEnable}
          className={`rounded-md px-2.5 py-1 text-xs disabled:opacity-50 ${
            itineraryShareEnabled
              ? "border border-line text-ink-700 hover:bg-paper-alt"
              : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {itineraryShareEnabled ? "關閉分享" : "開啟分享連結"}
        </button>
      </div>

      {itineraryShareEnabled && (
        <div className="mt-2 flex items-center gap-2">
          <input
            readOnly
            value={itineraryUrl}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-md border border-line bg-paper-alt px-2 py-1 text-xs text-ink-700"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-xs hover:bg-paper-alt"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success-700" />
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
