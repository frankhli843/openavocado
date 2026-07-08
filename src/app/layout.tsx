import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Disclaimer } from "@/components/Disclaimer";
import { GuestAccountBanner } from "@/components/GuestAccountBanner";

export const metadata: Metadata = {
  title: "Open Avocado — Adaptive Learning",
  description:
    "Open-source adaptive learning platform and lesson-generation framework. Multi-user, mastery-driven, locally-hosted.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <Disclaimer />
        <GuestAccountBanner />
        {children}
      </body>
    </html>
  );
}
