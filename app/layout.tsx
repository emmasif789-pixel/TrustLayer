import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://trustlayer-green-mu.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TrustLayer — Know what to trust before you act",
    template: "%s · TrustLayer",
  },
  description:
    "Paste a claim, URL, or message. TrustLayer finds real evidence, scores it transparently, and shows you what you actually know.",
  openGraph: {
    title: "TrustLayer — Know what to trust before you act",
    description: "Real evidence. Transparent scoring. Never fabricated.",
    url: SITE_URL,
    siteName: "TrustLayer",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "TrustLayer — Know what to trust before you act",
    description: "Real evidence. Transparent scoring. Never fabricated.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('trustlayer_theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (saved === 'dark' || (!saved && prefersDark)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
