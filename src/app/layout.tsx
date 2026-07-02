import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Trip Planner 雛型",
  description: "旅遊行程規劃 APP 原型",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
