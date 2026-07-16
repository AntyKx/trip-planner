"use client";

import { useState, type ReactNode } from "react";
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
  if (!src || broken) return <>{fallback}</>;
  return (
    <>
      {!loaded && <Skeleton className={className} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onError={() => setBroken(true)}
        onLoad={() => setLoaded(true)}
        className={`${className ?? ""} ${loaded ? "" : "hidden"}`}
      />
    </>
  );
}
