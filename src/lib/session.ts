import { createHmac, timingSafeEqual } from "crypto";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is not set");
  return secret;
}

export function signSession(userId: string): string {
  const payload = JSON.stringify({ userId, exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySession(cookieValue: string | undefined): { userId: string } | null {
  if (!cookieValue) return null;
  const [encoded, sig] = cookieValue.split(".");
  if (!encoded || !sig) return null;

  const expectedSig = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (typeof payload.userId !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "tp_session";
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;

// Set client-side once the splash screen's "開始旅程" button is clicked, so
// returning (still-unauthenticated) visitors skip straight to /login.
export const SPLASH_SEEN_COOKIE_NAME = "tp_seen_splash";
