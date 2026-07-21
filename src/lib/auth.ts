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

export type TripRole = "OWNER" | "EDITOR" | "VIEWER";

// Looks up the caller's relationship to a trip (owner, or collaborator
// role) in a single query. Redirects if there's no session or no
// relationship to the trip at all — every mutation action is reachable by
// direct POST, not just through the UI, so this must be re-checked here
// rather than trusted from the client. The trip detail page doesn't call
// this — it already fetches ownerId + collaborators as part of its own
// deep query and derives the role from that instead of querying twice.
export async function requireTripRole(
  tripId: string
): Promise<{ userId: string; role: TripRole }> {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE_NAME)?.value);
  if (!session) redirect("/login");

  const [user, trip] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } }),
    prisma.trip.findUnique({
      where: { id: tripId },
      // This runs on every single trip mutation (every action calls
      // requireTripRole via requireTripEditor/requireTripOwner) — "join"
      // avoids Prisma's default one-query-per-relation-level strategy for
      // this nested select, same reasoning as the page-level queries.
      relationLoadStrategy: "join",
      select: {
        ownerId: true,
        collaborators: {
          where: { userId: session.userId },
          select: { role: true },
        },
      },
    }),
  ]);
  if (!user) redirect("/login");
  if (!trip) redirect("/");

  const role: TripRole | null =
    trip.ownerId === user.id ? "OWNER" : (trip.collaborators[0]?.role ?? null);
  if (!role) redirect("/");

  return { userId: user.id, role };
}

// For mutations any collaborator with EDITOR role (or the owner) may
// perform — VIEWER is read-only and gets redirected like a non-member.
export async function requireTripEditor(tripId: string) {
  const { userId, role } = await requireTripRole(tripId);
  if (role === "VIEWER") redirect("/");
  return { id: userId };
}

// For owner-only actions: deleting the trip, managing who's on the
// collaborator list.
export async function requireTripOwner(tripId: string) {
  const { userId, role } = await requireTripRole(tripId);
  if (role !== "OWNER") redirect("/");
  return { id: userId };
}
