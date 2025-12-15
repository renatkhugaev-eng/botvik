import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Compiler for automatic optimizations
  reactCompiler: true,
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  
  // Experimental optimizations
  experimental: {
    // Optimize CSS
    optimizeCss: true,
    // Optimize package imports
    optimizePackageImports: ['framer-motion'],
  },
};

export default nextConfig;
