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
        {/* Preconnect to Vercel edge for faster API calls */}
        <link rel="preconnect" href="https://www.botvik.app" />
        <link rel="dns-prefetch" href="https://www.botvik.app" />
        {/* Preconnect to CDN origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${playfair.variable} ${manrope.variable} antialiased`}
        suppressHydrationWarning
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
            background: '#0a0a0f',
            zIndex: 9999,
          }}
        >
          {/* Simple spinner - minimal CSS */}
          <div
            id="loader-spinner"
            style={{
              width: 40,
              height: 40,
              border: '3px solid #333',
              borderTopColor: '#8B5CF6',
              borderRadius: '50%',
            }}
          />
          {/* Loading status - will be updated by inline script */}
          <p
            id="loader-status"
            style={{
              marginTop: 12,
              fontSize: 12,
              color: '#666',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Загрузка...
          </p>
        </div>
        {/* Critical inline styles and scripts - execute IMMEDIATELY */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes spin { to { transform: rotate(360deg); } }
              #loader-spinner { animation: spin 0.8s linear infinite; }
              .hydrated #static-loader { display: none; }
            `,
          }}
        />
        {/* Diagnostic script - shows loading progress */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var status = document.getElementById('loader-status');
                var start = Date.now();
                
                // Update status with timing
                function updateStatus(msg) {
                  if (status) {
                    var elapsed = ((Date.now() - start) / 1000).toFixed(1);
                    status.textContent = msg + ' (' + elapsed + 's)';
                  }
                }
                
                // Stage 1: HTML loaded
                updateStatus('HTML загружен');
                
                // Stage 2: DOM ready
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', function() {
                    updateStatus('DOM готов');
                  });
                } else {
                  updateStatus('DOM готов');
                }
                
                // Stage 3: All resources loaded
                window.addEventListener('load', function() {
                  updateStatus('Ресурсы загружены');
                });
                
                // Hide loader when React hydrates
                var checkHydration = function() {
                  if (document.body.children.length > 4) {
                    updateStatus('React готов');
                    setTimeout(function() {
                      document.body.classList.add('hydrated');
                    }, 100);
                  } else {
                    requestAnimationFrame(checkHydration);
                  }
                };
                requestAnimationFrame(checkHydration);
                
                // Timeout fallback - show error after 30 seconds
                setTimeout(function() {
                  if (!document.body.classList.contains('hydrated')) {
                    updateStatus('Таймаут загрузки');
                    if (status) status.style.color = '#f87171';
                  }
                }, 30000);
              })();
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
