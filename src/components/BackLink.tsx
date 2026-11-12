import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// The one "back" link style used at the top of every secondary page
// (settings, new trip, memories, itinerary/journal view, explore) — same
// icon, size and 40px tap height everywhere instead of four hand-rolled
// variants (←, ArrowLeft 14px, ArrowLeft 16px, ChevronLeft).
export default function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`-ml-1.5 inline-flex min-h-10 items-center gap-0.5 pr-2 text-sm font-medium text-ink-700 hover:text-ink-900 ${className ?? ""}`}
    >
      <ChevronLeft className="h-5 w-5" />
      {children}
    </Link>
  );
}
