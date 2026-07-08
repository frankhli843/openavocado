import type { Metadata } from "next";
import "./globals.css";
import { Disclaimer } from "@/components/Disclaimer";

export const metadata: Metadata = {
  title: "Open Avocado — Adaptive Learning",
  description:
    "Open-source adaptive learning platform. Multi-user, mastery-driven, locally-hosted.",
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
        {children}
      </body>
    </html>
  );
}
