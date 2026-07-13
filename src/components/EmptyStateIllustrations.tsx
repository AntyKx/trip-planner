// Paper-cut illustrations matching the app icon's own style (see
// public/icons/icon-192.png) — generated via gpt-image-1 and reviewed by
// the user before being wired in (see the illustration-review artifact,
// 2026-07-13). Framed as a small rounded tile (each source image is a
// solid cream background, not transparent) rather than a bare <img>, since
// that reads as an intentional framed illustration instead of a mismatched
// background rectangle sitting on the empty-state card's own white bg.

function IllustrationTile({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-28 w-28 rounded-2xl object-cover shadow-md ring-1 ring-black/5"
    />
  );
}

export function NoTripsIllustration() {
  return <IllustrationTile src="/illustrations/no-trips.webp" alt="" />;
}

export function NoChecklistItemsIllustration() {
  return <IllustrationTile src="/illustrations/checklist.webp" alt="" />;
}

export function NoFavoritesIllustration() {
  return <IllustrationTile src="/illustrations/favorites.webp" alt="" />;
}

export function NoSearchResultsIllustration() {
  return <IllustrationTile src="/illustrations/search.webp" alt="" />;
}

export function NoItemsTodayIllustration() {
  return <IllustrationTile src="/illustrations/no-items-today.webp" alt="" />;
}
