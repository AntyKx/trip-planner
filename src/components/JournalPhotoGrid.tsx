"use client";

import { useState } from "react";
import PhotoLightbox from "./PhotoLightbox";

export type JournalPhoto = { id: string; url: string };

// Hero image + thumbnail strip, like a product-gallery/social-post photo
// viewer — clicking a thumbnail swaps which photo shows big above (not an
// immediate lightbox open), and the active thumbnail gets a highlighted
// ring so it's clear which one is currently featured. Clicking the big
// photo itself opens a full-screen lightbox with prev/next.
export default function JournalPhotoGrid({
  photos,
}: {
  photos: JournalPhoto[];
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
              className={`w-16 shrink-0 rounded bg-white p-1 shadow-md transition hover:z-[var(--z-dropdown)] hover:scale-105 ${
                i === selectedIndex
                  ? "ring-2 ring-brand-500"
                  : "ring-1 ring-black/5"
              } ${i % 2 === 0 ? "-rotate-3" : "rotate-2"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="aspect-square w-full rounded-sm object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={(i) => {
            setSelectedIndex(i);
            setLightboxIndex(i);
          }}
        />
      )}
    </>
  );
}
