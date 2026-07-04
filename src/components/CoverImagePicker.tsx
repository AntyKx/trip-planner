"use client";

import {
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { ImageIcon, Camera } from "lucide-react";
import { updateTripCoverImage } from "@/app/trips/actions";

export default function CoverImagePicker({
  tripId,
  tripTitle,
  coverImage,
  currentCoverImage,
  availablePhotos,
  canEdit,
}: {
  tripId: string;
  tripTitle: string;
  coverImage?: string | null;
  currentCoverImage: string | null;
  availablePhotos: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [showEditButton, setShowEditButton] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function closeAll() {
    setIsOpen(false);
    setShowEditButton(false);
  }

  function apply(url: string | null) {
    startTransition(async () => {
      await updateTripCoverImage(tripId, url);
      router.refresh();
    });
    closeAll();
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

    if (!file.type.startsWith("image/")) {
      setUploadError("請選擇圖片檔案");
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      // Uploads straight from the browser to Vercel Blob (not through a
      // Server Action / Vercel Function), which caps request bodies at
      // 4.5MB — too small for real phone photos.
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      apply(blob.url);
    } catch (err) {
      setUploadError(
        err instanceof Error ? `上傳失敗：${err.message}` : "上傳失敗，請再試一次"
      );
    } finally {
      setIsUploading(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="absolute inset-0">
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt={tripTitle}
            className="h-full w-full object-cover"
          />
        )}
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <button
        type="button"
        onClick={() => setShowEditButton((v) => !v)}
        className="group block h-full w-full"
        aria-label="編輯封面圖片"
      >
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt={tripTitle}
            className="h-full w-full object-cover transition group-hover:brightness-95"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/80 transition group-hover:bg-black/10">
            點擊設定封面圖片
          </div>
        )}
      </button>

      {showEditButton && (
        <div className="absolute right-3 top-3">
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-black/60 disabled:opacity-50"
          >
            <ImageIcon className="h-4 w-4" />
            變更封面圖片
          </button>

          {isOpen && (
            <div className="absolute right-0 top-full z-10 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-lg sm:w-80">
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
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
                {isUploading ? "上傳中…" : "從手機相簿選擇"}
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
                        className="overflow-hidden rounded-lg border border-slate-200 hover:border-brand-400"
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
                  className="shrink-0 rounded-md bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-700"
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
                  onClick={closeAll}
                  className="ml-auto text-xs text-slate-500 hover:underline"
                >
                  關閉
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
