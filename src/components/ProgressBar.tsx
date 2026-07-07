export default function ProgressBar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-2 overflow-hidden rounded-full bg-slate-100 ${className ?? ""}`}
    >
      <div
        className="h-full rounded-full bg-brand-500 transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
