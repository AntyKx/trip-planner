import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/session";

// Cheap, optimistic first-line check — redirects obviously-unauthenticated
// requests to /login. Not the authority on ownership: every page/action
// still re-checks via requireUser()/requireTripOwner() in src/lib/auth.ts,
// since Server Functions aren't guaranteed to be covered by this matcher.
export function proxy(request: NextRequest) {
  const session = verifySession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/", "/trips/:path*", "/explore"],
};
