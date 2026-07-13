"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type JournalPhoto = { id: string; url: string };

// First photo runs full-width (the "cover shot" for this stop); the rest
// sit below as small rotated polaroid-style thumbnails, matching the
// mini-collage treatment already established on the login/welcome hero.
// Any photo opens a full-screen lightbox with prev/next.
export default function JournalPhotoGrid({ photos }: { photos: JournalPhoto[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") {
        setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
      }
      if (e.key === "ArrowRight") {
        setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxIndex, photos.length]);

  if (photos.length === 0) return null;
  const [first, ...rest] = photos;

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxIndex(0)}
        className="mt-3 block w-full overflow-hidden rounded-xl"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={first.url}
          alt=""
          className="aspect-[4/3] w-full object-cover transition hover:brightness-95"
        />
      </button>

      {rest.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 pt-1">
          {rest.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightboxIndex(i + 1)}
              className={`w-16 shrink-0 rounded bg-white p-1 shadow-md ring-1 ring-black/5 transition hover:z-10 hover:scale-105 ${
                i % 2 === 0 ? "-rotate-3" : "rotate-2"
              }`}
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
                  setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
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
                  setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
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
