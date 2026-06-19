import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AvocadoCore — Adaptive Learning",
  description: "Adaptive learning platform. Multi-user, mastery-driven, locally-hosted.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
