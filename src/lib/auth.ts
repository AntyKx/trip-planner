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
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE_NAME)?.value);
  if (!session) redirect("/login");

  const [user, trip] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId } }),
    prisma.trip.findUnique({ where: { id: tripId }, select: { ownerId: true } }),
  ]);
  if (!user) redirect("/login");
  if (!trip || trip.ownerId !== user.id) redirect("/");
  return user;
}
