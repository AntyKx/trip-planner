"use client";

import { useState, type ReactNode } from "react";

// Unifies two cases call sites used to handle separately (or not handle at
// all): no src to begin with, and a src that 404s at runtime (deleted Blob,
// expired Google photo URL, ...). Either one now renders the same
// `fallback`, instead of only the "missing src" case being covered by a
// hand-rolled ternary at each call site.
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
  if (!src || broken) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setBroken(true)} />
  );
}
