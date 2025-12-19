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
  
  // Headers for caching and performance
  async headers() {
    return [
      {
        // Cache static assets aggressively
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache animations
        source: '/animations/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Preload hints for Telegram
        source: '/miniapp/:path*',
        headers: [
          {
            key: 'Link',
            value: '<https://telegram.org>; rel=preconnect',
          },
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
