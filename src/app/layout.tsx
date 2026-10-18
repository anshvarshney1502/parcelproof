import type { Metadata, Viewport } from "next";
import { Newsreader, DM_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"], display: "swap" });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

const description = "Voice-first dispute preparation for online sellers. Turn tracking pages, invoices and customer voice notes into a sourced, reviewable case — then hear it back in English or Hinglish.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "ParcelProof — evidence workspace for parcel disputes", template: "%s · ParcelProof" },
  description,
  applicationName: "ParcelProof",
  openGraph: { type: "website", siteName: "ParcelProof", title: "ParcelProof — every claim needs evidence", description },
  twitter: { card: "summary", title: "ParcelProof", description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#f5f3ed" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${dmSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh bg-paper text-ink">{children}</body>
    </html>
  );
}
