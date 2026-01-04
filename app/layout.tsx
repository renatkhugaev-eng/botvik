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
        {/* ═══════════════════════════════════════════════════════════════
            STATIC LOADING — Shows IMMEDIATELY before JS loads
            This prevents white screen on slow connections
        ═══════════════════════════════════════════════════════════════ */}
        <div
          id="static-loader"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(to bottom, #0a0a0f, #0f0f1a)',
            zIndex: 9999,
            transition: 'opacity 0.3s ease-out',
          }}
        >
          {/* Animated spinner */}
          <div
            style={{
              width: 48,
              height: 48,
              border: '3px solid rgba(139, 92, 246, 0.2)',
              borderTopColor: '#8B5CF6',
              borderRadius: '50%',
              animation: 'static-spin 0.8s linear infinite',
            }}
          />
          {/* Loading text */}
          <p
            style={{
              marginTop: 16,
              fontSize: 14,
              color: 'rgba(255, 255, 255, 0.5)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Загрузка...
          </p>
        </div>
        {/* Inline CSS for spinner animation - no external CSS needed */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes static-spin {
                to { transform: rotate(360deg); }
              }
              /* Hide static loader once React hydrates */
              .hydrated #static-loader {
                opacity: 0;
                pointer-events: none;
              }
            `,
          }}
        />
        {/* Script to hide loader after hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Add hydrated class after a short delay to ensure React is ready
              // This hides the static loader smoothly
              if (typeof window !== 'undefined') {
                var checkHydration = function() {
                  if (document.querySelector('[data-nextjs-scroll-focus-boundary]') || 
                      document.querySelector('#__next') ||
                      document.querySelector('main') ||
                      document.body.children.length > 3) {
                    document.body.classList.add('hydrated');
                    // Also directly hide after 100ms for safety
                    setTimeout(function() {
                      var loader = document.getElementById('static-loader');
                      if (loader) loader.style.display = 'none';
                    }, 300);
                  } else {
                    requestAnimationFrame(checkHydration);
                  }
                };
                // Start checking, but also set a max timeout
                requestAnimationFrame(checkHydration);
                // Fallback: hide loader after 10 seconds max (in case of error)
                setTimeout(function() {
                  var loader = document.getElementById('static-loader');
                  if (loader) loader.style.display = 'none';
                }, 10000);
              }
            `,
          }}
        />
        
        <PosthogProvider>
          {children}
        </PosthogProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
