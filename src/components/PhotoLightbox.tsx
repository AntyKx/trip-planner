"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export default function PhotoLightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  photos: { id: string; url: string }[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") onIndexChange((index + 1) % photos.length);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [index, photos.length, onClose, onIndexChange]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[var(--z-chrome)] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="關閉"
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center text-white/80 hover:text-white sm:right-4 sm:top-4"
      >
        <X className="h-6 w-6" />
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index - 1 + photos.length) % photos.length);
            }}
            aria-label="上一張"
            className="absolute left-1 flex h-11 w-11 items-center justify-center text-white/80 hover:text-white sm:left-4"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index + 1) % photos.length);
            }}
            aria-label="下一張"
            className="absolute right-1 flex h-11 w-11 items-center justify-center text-white/80 hover:text-white sm:right-4"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[index].url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />

      {photos.length > 1 && (
        <p className="absolute bottom-4 text-xs text-white/70">
          {index + 1} / {photos.length}
        </p>
      )}
    </div>,
    document.body,
  );
}
