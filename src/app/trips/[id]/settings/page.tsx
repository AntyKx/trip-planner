import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import AppCard from "@/components/AppCard";
import DeleteTripButton from "@/components/DeleteTripButton";

export default async function TripSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, trip] = await Promise.all([
    getCurrentUser(),
    prisma.trip.findUnique({
      where: { id },
      select: { id: true, title: true, ownerId: true },
    }),
  ]);

  if (!user) redirect(`/login?next=${encodeURIComponent(`/trips/${id}/settings`)}`);
  if (!trip) notFound();
  // Settings (and the delete button inside it) are owner-only — anyone
  // else lands back on the trip page instead of a dead end.
  if (trip.ownerId !== user.id) redirect(`/trips/${id}`);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <Link
        href={`/trips/${id}`}
        className="inline-flex items-center gap-1 text-sm text-ink-700 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        回行程
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-ink-900">行程設定</h1>
      <p className="mt-1 text-sm text-ink-500">{trip.title}</p>

      <AppCard
        padding="lg"
        className="mt-8 border-red-200"
      >
        <h2 className="text-sm font-semibold text-red-600">危險區域</h2>
        <p className="mt-1 text-sm text-ink-500">
          刪除行程後將無法復原,所有天數、景點與清單資料都會一併移除。
        </p>
        <div className="mt-4">
          <DeleteTripButton tripId={trip.id} tripTitle={trip.title} />
        </div>
      </AppCard>
    </main>
  );
}
