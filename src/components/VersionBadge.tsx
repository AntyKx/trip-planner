export default function VersionBadge() {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID;
  if (!buildId) return null;

  return (
    <p className="pointer-events-none fixed right-2 top-1 z-10 text-[10px] text-slate-400/70">
      v{buildId}
    </p>
  );
}
