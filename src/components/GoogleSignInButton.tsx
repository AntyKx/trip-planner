"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type UserCredential,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebaseClient";
import { signInWithGoogle } from "@/app/login/actions";

const POPUP_BLOCKED_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);
const USER_CANCELLED_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/null",
]);

function isStandalonePwa() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isInAppBrowser() {
  const ua = navigator.userAgent || "";
  return /Line\/|FBAN|FBAV|Instagram/i.test(ua);
}

function isIosSafari() {
  const ua = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function preferRedirect() {
  if (isStandalonePwa()) return false;
  return isInAppBrowser() || isIosSafari();
}

export default function GoogleSignInButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeSignIn(result: UserCredential) {
    const idToken = await result.user.getIdToken();
    await signInWithGoogle(idToken);
    router.push("/");
    router.refresh();
  }

  // Catches the return leg of a signInWithRedirect() call (iOS Safari /
  // in-app browsers use the redirect flow instead of a popup).
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          setIsPending(true);
          return completeSignIn(result);
        }
      })
      .catch((err) => {
        const code = err?.code as string | undefined;
        if (code && USER_CANCELLED_CODES.has(code)) return;
        setError("登入失敗，請再試一次");
      })
      .finally(() => setIsPending(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn() {
    setError(null);
    setIsPending(true);
    try {
      if (preferRedirect()) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      const result = await signInWithPopup(auth, googleProvider);
      await completeSignIn(result);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code && USER_CANCELLED_CODES.has(code)) {
        setIsPending(false);
        return;
      }
      if (code && POPUP_BLOCKED_CODES.has(code)) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch {
          setError("登入失敗，請再試一次");
        }
      } else {
        setError("登入失敗，請再試一次");
      }
      setIsPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://www.google.com/favicon.ico"
          width={18}
          height={18}
          alt=""
          className="rounded-sm bg-white p-0.5"
        />
        {isPending ? "登入中…" : "使用 Google 帳號登入"}
      </button>
      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
