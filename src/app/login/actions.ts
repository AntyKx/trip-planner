"use server";

import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session";

export async function signInWithGoogle(idToken: string) {
  const decoded = await getAdminAuth().verifyIdToken(idToken);
  const { uid, email, name, picture } = decoded;
  if (!email) throw new Error("這個 Google 帳號沒有 email，無法登入");

  let user = await prisma.user.findUnique({ where: { googleUid: uid } });
  if (!user) {
    // Google already verifies email ownership, so it's safe to link a
    // pre-existing User row by email on first Google sign-in (e.g. the
    // original prototype owner claiming their existing trips).
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    user = existingByEmail
      ? await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { googleUid: uid, avatarUrl: existingByEmail.avatarUrl ?? picture },
        })
      : await prisma.user.create({
          data: { googleUid: uid, email, name: name ?? email, avatarUrl: picture },
        });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, signSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function signOutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
