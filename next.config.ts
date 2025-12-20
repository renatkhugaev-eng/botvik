import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // React Compiler for automatic optimizations
  reactCompiler: true,
  
  // Disable trailing slash redirects (important for webhooks)
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  
  // Image optimization for LCP
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // Domains for external images (Telegram avatars)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 't.me',
      },
      {
        protocol: 'https',
        hostname: '**.telegram.org',
      },
    ],
  },
  
  // Experimental optimizations
  experimental: {
    // Optimize CSS for faster first paint
    optimizeCss: true,
    // Optimize package imports for smaller bundles
    optimizePackageImports: [
      'framer-motion',
      '@sentry/nextjs',
      'posthog-js',
      'lottie-react',
    ],
  },
  
  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Headers for caching, performance, and security (Cloudflare optimized)
  async headers() {
    return [
      // ═══════════════════════════════════════════════════════════════
      // SECURITY HEADERS (все страницы)
      // ═══════════════════════════════════════════════════════════════
      {
        source: '/:path*',
        headers: [
          // Prevent clickjacking (allow Telegram iframe)
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://web.telegram.org',
          },
          // XSS Protection
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Referrer Policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions Policy (disable unused features)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      
      // ═══════════════════════════════════════════════════════════════
      // STATIC ASSETS — Aggressive caching (1 year, Cloudflare cached)
      // ═══════════════════════════════════════════════════════════════
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'CDN-Cache-Control', value: 'public, max-age=31536000' }, // Cloudflare
        ],
      },
      {
        source: '/animations/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'CDN-Cache-Control', value: 'public, max-age=31536000' },
        ],
      },
      {
        source: '/frames/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'CDN-Cache-Control', value: 'public, max-age=31536000' },
        ],
      },
      {
        source: '/rive/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'CDN-Cache-Control', value: 'public, max-age=31536000' },
        ],
      },
      
      // ═══════════════════════════════════════════════════════════════
      // FONTS — Long cache with stale-while-revalidate
      // ═══════════════════════════════════════════════════════════════
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'CDN-Cache-Control', value: 'public, max-age=31536000' },
        ],
      },
      
      // ═══════════════════════════════════════════════════════════════
      // API — No caching, but allow Cloudflare to see headers
      // ═══════════════════════════════════════════════════════════════
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
      
      // ═══════════════════════════════════════════════════════════════
      // MINIAPP — Short cache + preconnect
      // ═══════════════════════════════════════════════════════════════
      {
        source: '/miniapp/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
          { key: 'CDN-Cache-Control', value: 'public, max-age=60' }, // Cloudflare caches 60s
          { key: 'Link', value: '<https://telegram.org>; rel=preconnect' },
        ],
      },
    ];
  },
};

// Sentry configuration options
const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  hideSourceMaps: true,
  reactComponentAnnotation: {
    enabled: true,
  },
  tunnelRoute: "/monitoring",
};

// Export with Sentry wrapper (only if DSN is configured)
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryConfig)
  : nextConfig;
