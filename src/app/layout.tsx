import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"] });
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Luxury Within Budget — Taj hotel price calendar",
  description: "Find the dates when a Taj or other Indian luxury hotel fits your nightly or total-stay budget, with full-stay prices including taxes and fees.",
  authors: [{ name: "Shivankar" }],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
