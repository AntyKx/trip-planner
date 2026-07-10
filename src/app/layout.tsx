import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Caveat } from "next/font/google";
import InstallPrompt from "@/components/InstallPrompt";
import UpdateChecker from "@/components/UpdateChecker";
import VersionBadge from "@/components/VersionBadge";
import ToastProvider from "@/components/Toast";
import ServiceWorkerCleanup from "@/components/ServiceWorkerCleanup";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Handwritten-style accent font for the splash/login wordmark and taglines —
// matches the travel-journal art direction (see 開頭畫面/登入畫面 references).
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Trip Planner",
  description: "你的旅行手帳與行程規劃助手",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    // "black-translucent" lets the webview draw behind the notch/status
    // bar (needed for the full-bleed top strip below) instead of iOS
    // reserving that space with its own opaque bar — only takes effect
    // when installed to the home screen (standalone mode); a no-op in
    // regular Safari tabs.
    statusBarStyle: "black-translucent",
    title: "Trip Planner",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b6094",
  // Without an explicit width/initialScale, mobile browsers fall back to
  // treating this as a desktop-width page and scale the whole thing down
  // to fit — the "everything looks zoomed out" complaint. Deliberately
  // NOT setting maximumScale/userScalable: disabling pinch-zoom would
  // "fix" the input-focus auto-zoom too, but it's an accessibility
  // regression (WCAG 1.4.4) — that's fixed properly instead by keeping
  // every form field's font-size at 16px+ (see globals.css), which stops
  // iOS from needing to zoom in the first place.
  width: "device-width",
  initialScale: 1,
  // Required for env(safe-area-inset-*) to report real values instead of
  // 0 — without this, both the status-bar strip and every safe-area
  // padding below (Toast, InstallPrompt, VersionBadge) is a no-op.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper pt-[env(safe-area-inset-top)] text-ink-900">
        {/* Solid strip behind the notch/status bar — with statusBarStyle
            "black-translucent" the webview draws full-bleed under it, so
            without this the status bar icons (always white/light) would
            sit directly on whatever the page's own background happens to
            be, which is unreadable against this app's light paper tone.
            A solid color (not a translucent gradient) keeps the icons
            legible regardless of what's on the page — deterministic
            rather than something that needs checking on a real device.
            body's own top padding (env safe-area-inset-top) above reserves
            the exact same height, so page content starts right where this
            strip ends. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[env(safe-area-inset-top)] bg-brand-800"
        />
        <ServiceWorkerCleanup />
        <ToastProvider>
          <UpdateChecker />
          {children}
          <InstallPrompt />
          <VersionBadge />
        </ToastProvider>
      </body>
    </html>
  );
}
