"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateTripCoverImage } from "@/app/trips/actions";

export default function CoverImagePicker({
  tripId,
  currentCoverImage,
  availablePhotos,
}: {
  tripId: string;
  currentCoverImage: string | null;
  availablePhotos: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [isPending, startTransition] = useTransition();

  function apply(url: string | null) {
    startTransition(() => {
      updateTripCoverImage(tripId, url);
    });
    setIsOpen(false);
    setCustomUrl("");
  }

  function handleCustomSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customUrl.trim()) return;
    apply(customUrl.trim());
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={isPending}
        className="rounded-lg bg-black/50 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-black/60 disabled:opacity-50"
      >
        🖼️ 變更封面圖片
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-10 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-lg sm:w-80">
          {availablePhotos.length > 0 && (
            <>
              <p className="text-xs font-medium text-slate-600">
                從行程裡的地點照片挑選
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {availablePhotos.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => apply(url)}
                    className="overflow-hidden rounded-lg border border-slate-200 hover:border-indigo-400"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-14 w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}

          <form onSubmit={handleCustomSubmit} className="mt-3 flex gap-2">
            <input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="或貼上圖片網址"
              className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700"
            >
              套用
            </button>
          </form>

          <div className="mt-3 flex items-center justify-between">
            {currentCoverImage && (
              <button
                type="button"
                onClick={() => apply(null)}
                className="text-xs text-red-500 hover:underline"
              >
                移除封面（改回自動帶入）
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="ml-auto text-xs text-slate-500 hover:underline"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
