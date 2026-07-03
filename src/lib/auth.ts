import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/session";

export async function getCurrentUser() {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireTripOwner(tripId: string) {
  const user = await requireUser();
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { ownerId: true },
  });
  if (!trip || trip.ownerId !== user.id) redirect("/");
  return user;
}
