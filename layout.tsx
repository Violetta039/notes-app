
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notatnik — Twoja przestrzeń",
  description: "Minimalistyczna aplikacja do organizowania notatek.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
