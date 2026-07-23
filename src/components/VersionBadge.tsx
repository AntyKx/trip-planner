export default function VersionBadge() {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID;
  if (!buildId) return null;

  // Not fixed — it used to pin to the top-right corner on every screen,
  // which started competing with other top-of-viewport UI (e.g. the
  // sticky 時間軸／地圖 toggle). This is just a quiet reference marker,
  // not something that needs to stay visible without scrolling, so it
  // now sits in normal flow at the very end of the page instead.
  return (
    <p className="pointer-events-none py-2 text-center text-[10px] text-ink-400/70">
      v{buildId}
    </p>
  );
}
