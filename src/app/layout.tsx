import type { Metadata, Viewport } from "next";
import { Newsreader, DM_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"], display: "swap" });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "ParcelProof — evidence workspace for parcel disputes", template: "%s · ParcelProof" },
  description: "Every claim needs evidence. Every piece of evidence needs context. Organise delivery-dispute evidence into a traceable, reviewable case.",
};

export const viewport: Viewport = { themeColor: "#f5f3ed" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${dmSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh bg-paper text-ink">{children}</body>
    </html>
  );
}
