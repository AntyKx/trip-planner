export default function VersionBadge() {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID;
  if (!buildId) return null;

  return (
    <p className="pointer-events-none fixed right-2 top-[calc(0.25rem+env(safe-area-inset-top))] z-[var(--z-dropdown)] text-[10px] text-ink-400/70">
      v{buildId}
    </p>
  );
}
