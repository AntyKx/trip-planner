import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTripRole } from "@/lib/auth";
import JournalBook from "@/components/JournalBook";

// Signed-in preview of the "旅遊書" — same query/rendering as the public
// /journal/[token] page, just reached by tripId + session instead of the
// share token, so the owner/collaborators can see exactly what a public
// viewer would see without first turning sharing on.
export default async function JournalPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireTripRole(id);

  const trip = await prisma.trip.findUnique({
    where: { id },
    select: {
      title: true,
      startDate: true,
      endDate: true,
      coverImage: true,
      days: {
        orderBy: { dayIndex: "asc" },
        select: {
          id: true,
          dayIndex: true,
          date: true,
          items: {
            orderBy: { sortOrder: "asc" },
            where: {
              OR: [{ journalText: { not: null } }, { photos: { some: {} } }],
            },
            select: {
              id: true,
              type: true,
              note: true,
              journalText: true,
              place: { select: { name: true, address: true } },
              photos: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, url: true },
              },
            },
          },
        },
      },
    },
  });
  if (!trip) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl bg-paper px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        <Link href={`/trips/${id}`} className="flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          回行程
        </Link>
        <span>預覽模式 · 只有你看得到這個畫面，公開連結需要另外開啟</span>
      </div>
      <JournalBook trip={trip} />
    </main>
  );
}
