"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Skeleton } from "./LoadingSkeleton";

// Unifies two cases call sites used to handle separately (or not handle at
// all): no src to begin with, and a src that 404s at runtime (deleted Blob,
// expired Google photo URL, ...). Either one now renders the same
// `fallback`, instead of only the "missing src" case being covered by a
// hand-rolled ternary at each call site. Also fills the gap while a valid
// image is still downloading: a Skeleton (same className, so identically
// sized/shaped) stands in until onLoad fires, instead of an empty gap that
// pops straight to the finished photo.
export default function ImgWithFallback({
  src,
  alt,
  className,
  fallback,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // A browser-cached image can finish loading before React ever attaches
  // the onLoad listener (a well-known React/DOM race) — that left the
  // skeleton stuck forever for any photo already cached from an earlier
  // page visit (e.g. seen once inside a trip, then never showing on the
  // home page afterward). `.complete` catches that case right after mount;
  // `naturalWidth > 0` distinguishes an already-succeeded load from an
  // already-failed one (both make `.complete` true).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(false);
    setBroken(false);
    const img = imgRef.current;
    if (img?.complete) {
      if (img.naturalWidth > 0) setLoaded(true);
      else setBroken(true);
    }
  }, [src]);

  if (!src || broken) return <>{fallback}</>;
  return (
    <>
      {!loaded && <Skeleton className={className} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onError={() => setBroken(true)}
        onLoad={() => setLoaded(true)}
        className={`${className ?? ""} ${loaded ? "" : "hidden"}`}
      />
    </>
  );
}
