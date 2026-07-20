"use client";

import { useEffect, useRef, useState } from "react";

export type AvatarPerson = { name: string; avatarUrl?: string | null };

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
};

export function Avatar({
  name,
  avatarUrl,
  size = "sm",
}: AvatarPerson & { size?: keyof typeof SIZE_CLASSES }) {
  const sizeClass = SIZE_CLASSES[size];
  // Google avatar URLs can 404 (token expiry, photo removed) — falls back
  // to the initial-letter circle instead of showing a broken-image icon.
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // A browser-cached failed image can be `.complete` before React attaches
  // the onError listener (same race fixed in ImgWithFallback.tsx) — without
  // this, a previously-404'd avatar silently shows the browser's broken-
  // image icon instead of falling back to the initial-letter circle.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBroken(false);
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) setBroken(true);
  }, [avatarUrl]);

  if (avatarUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imgRef}
        src={avatarUrl}
        alt={name}
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white ${sizeClass}`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-medium text-brand-700 ring-2 ring-white ${sizeClass}`}
    >
      {name.slice(0, 1)}
    </div>
  );
}

// Overlapping avatar stack (see the collaborator list on Home trip cards
// and CollaboratorsPanel) — caps how many faces show and folds the rest
// into a "+N" pill instead of the row growing unbounded.
export function AvatarStack({
  members,
  max = 4,
  size = "sm",
}: {
  members: AvatarPerson[];
  max?: number;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((m, i) => (
        <Avatar key={i} name={m.name} avatarUrl={m.avatarUrl} size={size} />
      ))}
      {overflow > 0 && (
        <div
          className={`flex shrink-0 items-center justify-center rounded-full bg-line font-medium text-ink-700 ring-2 ring-white ${SIZE_CLASSES[size]}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
