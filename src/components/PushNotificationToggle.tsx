"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { subscribeToPush, unsubscribeFromPush } from "@/app/pushActions";
import { useToast } from "./Toast";

// PushManager's applicationServerKey wants a raw Uint8Array, not the
// base64url string VAPID keys are normally handed around as.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Hidden entirely on browsers without the required APIs (iOS Safari unless
// added to the home screen, older browsers) rather than showing a button
// that would just fail — starts "checking" so it doesn't flash visible
// then disappear on the browsers where it's about to hide itself.
type Support = "checking" | "unsupported" | "supported";

export default function PushNotificationToggle() {
  const toast = useToast();
  const [support, setSupport] = useState<Support>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupport("unsupported");
      return;
    }
    setSupport("supported");

    // Registered unconditionally (not just on subscribe) so a returning
    // subscriber's status is correctly reflected on load — getSubscription()
    // needs a registration to ask.
    navigator.serviceWorker.register("/push-sw.js").then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub);
      });
    });
  }, []);

  async function handleEnable() {
    setIsPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("需要允許通知權限才能開啟，可以之後在瀏覽器設定重新開啟");
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        toast.error("推播功能尚未設定完成");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("subscription missing endpoint or keys");
      }

      await subscribeToPush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setSubscribed(true);
      toast.success("已開啟推播通知");
    } catch (err) {
      console.error("push subscribe failed:", err);
      toast.error("開啟推播失敗，請稍後再試");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDisable() {
    setIsPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Server row removed first — if the browser-side unsubscribe below
        // throws, the worst case is a dead subscription that just bounces
        // off web-push's 404/410 handling next send, not a phantom DB row
        // pointing at a subscription the browser insists it doesn't have.
        await unsubscribeFromPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      toast.success("已關閉推播通知");
    } catch (err) {
      console.error("push unsubscribe failed:", err);
      toast.error("關閉推播失敗，請稍後再試");
    } finally {
      setIsPending(false);
    }
  }

  if (support !== "supported") return null;

  return (
    <button
      type="button"
      onClick={subscribed ? handleDisable : handleEnable}
      disabled={isPending}
      aria-label={subscribed ? "關閉推播通知" : "開啟推播通知"}
      title={subscribed ? "推播通知已開啟，點一下關閉" : "開啟推播通知"}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${
        subscribed ? "text-brand-600" : "text-ink-500 hover:text-brand-600"
      }`}
    >
      {subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
    </button>
  );
}
