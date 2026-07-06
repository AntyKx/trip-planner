"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTripEditor } from "@/lib/auth";
import {
  GENERIC_TEMPLATE,
  getDestinationTemplates,
  type ChecklistCategoryValue,
} from "@/lib/checklistTemplates";

// Same reasoning as requireDayInTrip in src/app/trips/actions.ts: these
// actions only take an itemId (not a tripId), so the item's real trip has
// to be looked up server-side before checking the role — otherwise a user
// with EDITOR on *some* trip of their own could pass another trip's
// checklist item id and mutate it.
async function getChecklistItemTripId(itemId: string): Promise<string> {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: { tripId: true },
  });
  if (!item) redirect("/");
  return item.tripId;
}

// Seeds the generic template plus whichever destination templates match
// countries actually present among the trip's Place items right now (see
// src/lib/checklistTemplates.ts — there's no stored Trip.destination).
// Safe to call repeatedly: already-seeded sourceKeys are skipped, so this
// doubles as the "補上目的地清單" action once new countries show up.
export async function generateChecklistForTrip(tripId: string) {
  await requireTripEditor(tripId);

  const [existing, places, currentCount] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { tripId, sourceKey: { not: null } },
      select: { sourceKey: true },
    }),
    prisma.place.findMany({
      where: { items: { some: { day: { tripId } } } },
      select: { country: true },
      distinct: ["country"],
    }),
    prisma.checklistItem.count({ where: { tripId } }),
  ]);

  const existingKeys = new Set(existing.map((e) => e.sourceKey));
  const countries = places.map((p) => p.country);

  const candidates = [
    ...GENERIC_TEMPLATE.map((entry) => ({ ...entry, source: "DEFAULT" as const })),
    ...getDestinationTemplates(countries).map((entry) => ({
      ...entry,
      source: "DESTINATION_TEMPLATE" as const,
    })),
  ].filter((entry) => !existingKeys.has(entry.sourceKey));

  if (candidates.length === 0) return;

  await prisma.checklistItem.createMany({
    data: candidates.map((entry, index) => ({
      tripId,
      title: entry.title,
      category: entry.category,
      source: entry.source,
      sourceKey: entry.sourceKey,
      sortOrder: currentCount + index + 1,
    })),
    // Belt-and-suspenders alongside the existingKeys filter above — guards
    // against a race between two concurrent calls (e.g. auto-generate on
    // trip creation overlapping a manual "補上目的地清單" click).
    skipDuplicates: true,
  });

  revalidatePath(`/trips/${tripId}`);
}

export async function addChecklistItem(
  tripId: string,
  input: {
    title: string;
    category?: ChecklistCategoryValue;
    note?: string;
    dueDate?: string | null;
  }
) {
  await requireTripEditor(tripId);
  const title = input.title.trim();
  if (!title) return;

  const last = await prisma.checklistItem.findFirst({
    where: { tripId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.checklistItem.create({
    data: {
      tripId,
      title,
      category: input.category ?? "CUSTOM",
      note: input.note?.trim() || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      source: "USER",
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(`/trips/${tripId}`);
}

export async function updateChecklistItem(
  itemId: string,
  input: {
    title?: string;
    category?: ChecklistCategoryValue;
    note?: string | null;
    dueDate?: string | null;
  }
) {
  const tripId = await getChecklistItemTripId(itemId);
  await requireTripEditor(tripId);

  await prisma.checklistItem.updateMany({
    where: { id: itemId, tripId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
    },
  });
  revalidatePath(`/trips/${tripId}`);
}

export async function toggleChecklistItem(itemId: string, isDone: boolean) {
  const tripId = await getChecklistItemTripId(itemId);
  const { id: userId } = await requireTripEditor(tripId);

  await prisma.checklistItem.updateMany({
    where: { id: itemId, tripId },
    data: {
      isDone,
      doneAt: isDone ? new Date() : null,
      doneById: isDone ? userId : null,
    },
  });
  revalidatePath(`/trips/${tripId}`);
}

export async function deleteChecklistItem(itemId: string) {
  const tripId = await getChecklistItemTripId(itemId);
  await requireTripEditor(tripId);
  await prisma.checklistItem.deleteMany({ where: { id: itemId, tripId } });
  revalidatePath(`/trips/${tripId}`);
}

// OWNER and EDITOR can both assign — identical to requireTripEditor's own
// gate (it already lets OWNER through), so no separate owner-only check is
// needed here.
export async function assignChecklistItem(itemId: string, userId: string | null) {
  const tripId = await getChecklistItemTripId(itemId);
  await requireTripEditor(tripId);

  if (userId) {
    // Only lets this be assigned to someone who actually has access to the
    // trip — an arbitrary userId isn't necessarily a collaborator just
    // because the caller is one.
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        ownerId: true,
        collaborators: { where: { userId }, select: { userId: true } },
      },
    });
    const isMember = !!trip && (trip.ownerId === userId || trip.collaborators.length > 0);
    if (!isMember) redirect("/");
  }

  await prisma.checklistItem.updateMany({
    where: { id: itemId, tripId },
    data: { assignedToId: userId },
  });
  revalidatePath(`/trips/${tripId}`);
}

// No revalidatePath on purpose, matching reorderItems in
// src/app/trips/actions.ts — the client already reflects the new order
// optimistically, and this is called on every drag.
export async function reorderChecklistItems(tripId: string, orderedItemIds: string[]) {
  await requireTripEditor(tripId);
  await prisma.$transaction(
    orderedItemIds.map((id, index) =>
      prisma.checklistItem.updateMany({
        where: { id, tripId },
        data: { sortOrder: index + 1 },
      })
    )
  );
}
