"use client";

import {
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { updateTripCoverImage, uploadCoverImagePhoto } from "@/app/trips/actions";

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadCoverImagePhoto(formData);
      if (result.ok) {
        apply(result.url);
      } else {
        setUploadError(result.error);
      }
    } finally {
      setIsUploading(false);
    }
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isUploading ? "上傳中…" : "📷 從手機相簿選擇"}
          </button>
          {uploadError && (
            <p className="mt-2 text-xs text-red-500">{uploadError}</p>
          )}

          {availablePhotos.length > 0 && (
            <>
              <p className="mt-3 text-xs font-medium text-slate-600">
                或從行程裡的地點照片挑選
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
