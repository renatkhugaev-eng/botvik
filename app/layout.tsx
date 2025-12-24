import type { Metadata, Viewport } from "next";
import { Playfair_Display, Manrope } from "next/font/google";
import "./globals.css";
import { PosthogProvider } from "@/components/PosthogProvider";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap", // Prevent FOIT (Flash of Invisible Text)
  preload: true,
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: true,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f1f5f9",
  // Critical for iPhone X+ notch support
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Botvik — Квизы и расследования",
    template: "%s | Botvik",
  },
  description: "Telegram Mini App с квизами, дуэлями, турнирами и детективными расследованиями. Играй, соревнуйся с друзьями и получай награды!",
  keywords: ["квизы", "telegram", "mini app", "викторины", "дуэли", "расследования"],
  authors: [{ name: "Botvik Team" }],
  creator: "Botvik",
  publisher: "Botvik",
  robots: {
    index: false, // Telegram Mini App не индексируется
    follow: false,
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Botvik",
    title: "Botvik — Квизы и расследования",
    description: "Telegram Mini App с квизами, дуэлями и детективными расследованиями",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Botvik — Квизы и расследования",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Botvik — Квизы и расследования",
    description: "Telegram Mini App с квизами, дуэлями и детективными расследованиями",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to critical origins for faster resource loading */}
        <link rel="preconnect" href="https://telegram.org" />
        <link rel="dns-prefetch" href="https://telegram.org" />
        {/* Preconnect to API (same origin, but helps with early connection) */}
        <link rel="preconnect" href="/" />
      </head>
      <body
        className={`${playfair.variable} ${manrope.variable} antialiased`}
      >
        <PosthogProvider>
          {children}
        </PosthogProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
