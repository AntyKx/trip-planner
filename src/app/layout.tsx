import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Caveat } from "next/font/google";
import InstallPrompt from "@/components/InstallPrompt";
import UpdateChecker from "@/components/UpdateChecker";
import VersionBadge from "@/components/VersionBadge";
import ToastProvider from "@/components/Toast";
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
    statusBarStyle: "default",
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
      <body className="min-h-full flex flex-col bg-paper text-ink-900">
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
