import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Caveat } from "next/font/google";
import InstallPrompt from "@/components/InstallPrompt";
import UpdateChecker from "@/components/UpdateChecker";
import VersionBadge from "@/components/VersionBadge";
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
        <UpdateChecker />
        {children}
        <InstallPrompt />
        <VersionBadge />
      </body>
    </html>
  );
}
