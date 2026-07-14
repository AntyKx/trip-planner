"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type JournalPhoto = { id: string; url: string };

// Hero image + thumbnail strip, like a product-gallery/social-post photo
// viewer — clicking a thumbnail swaps which photo shows big above (not an
// immediate lightbox open), and the active thumbnail gets a highlighted
// ring so it's clear which one is currently featured. Clicking the big
// photo itself opens a full-screen lightbox with prev/next.
export default function JournalPhotoGrid({ photos }: { photos: JournalPhoto[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") {
        setLightboxIndex((i) => {
          const next = i === null ? null : (i - 1 + photos.length) % photos.length;
          if (next !== null) setSelectedIndex(next);
          return next;
        });
      }
      if (e.key === "ArrowRight") {
        setLightboxIndex((i) => {
          const next = i === null ? null : (i + 1) % photos.length;
          if (next !== null) setSelectedIndex(next);
          return next;
        });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxIndex, photos.length]);

  if (photos.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxIndex(selectedIndex)}
        className="mt-3 block w-full overflow-hidden rounded-xl"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[selectedIndex].url}
          alt=""
          className="aspect-[4/3] w-full object-cover transition hover:brightness-95"
        />
      </button>

      {photos.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-3 pt-1">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedIndex(i)}
              aria-label={`顯示第 ${i + 1} 張照片`}
              aria-current={i === selectedIndex}
              className={`w-16 shrink-0 rounded bg-white p-1 shadow-md transition hover:z-10 hover:scale-105 ${
                i === selectedIndex ? "ring-2 ring-brand-500" : "ring-1 ring-black/5"
              } ${i % 2 === 0 ? "-rotate-3" : "rotate-2"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="aspect-square w-full rounded-sm object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
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
                  const next = (selectedIndex - 1 + photos.length) % photos.length;
                  setSelectedIndex(next);
                  setLightboxIndex(next);
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
                  const next = (selectedIndex + 1) % photos.length;
                  setSelectedIndex(next);
                  setLightboxIndex(next);
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
            src={photos[lightboxIndex].url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />

          {photos.length > 1 && (
            <p className="absolute bottom-4 text-xs text-white/70">
              {lightboxIndex + 1} / {photos.length}
            </p>
          )}
        </div>
      )}
    </>
  );
}
