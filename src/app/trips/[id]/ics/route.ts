import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTripRole } from "@/lib/auth";
import { buildTripIcs } from "@/lib/ics";

// Any collaborator (including VIEWER) can export their own calendar copy —
// unlike mutations, reading isn't restricted to editors.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await requireTripRole(id);

  const trip = await prisma.trip.findUnique({
    where: { id },
    select: {
      title: true,
      days: {
        select: {
          items: {
            select: {
              id: true,
              type: true,
              startTime: true,
              endTime: true,
              note: true,
              confirmationNumber: true,
              place: { select: { name: true, address: true } },
            },
          },
        },
      },
    },
  });
  if (!trip) return NextResponse.json({ error: "找不到行程" }, { status: 404 });

  const items = trip.days.flatMap((day) =>
    day.items.map((item) => ({
      id: item.id,
      type: item.type,
      placeName: item.place?.name ?? null,
      placeAddress: item.place?.address ?? null,
      note: item.note,
      confirmationNumber: item.confirmationNumber,
      startTime: item.startTime,
      endTime: item.endTime,
    }))
  );

  const ics = buildTripIcs(trip.title, items);

  // Chinese trip titles aren't valid in the plain `filename=` param (RFC
  // 6266) — pair an ASCII fallback with the encoded `filename*=` form so
  // older parsers still get a usable name instead of a mangled one.
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="trip.ics"; filename*=UTF-8''${encodeURIComponent(trip.title)}.ics`,
    },
  });
}
