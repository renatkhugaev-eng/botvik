"use client";

import { useEffect, useState } from "react";

type PerformanceLevel = "high" | "medium" | "low";

interface PerformanceConfig {
  level: PerformanceLevel;
  // Animation settings
  enableBlur: boolean;
  enableParticles: boolean;
  enableInfiniteAnimations: boolean;
  particleCount: number;
  // Framer motion settings
  animationDuration: number;
  springStiffness: number;
  springDamping: number;
}

const HIGH_PERFORMANCE: PerformanceConfig = {
  level: "high",
  enableBlur: true,
  enableParticles: true,
  enableInfiniteAnimations: true,
  particleCount: 8,
  animationDuration: 0.3,
  springStiffness: 500,
  springDamping: 30,
};

const MEDIUM_PERFORMANCE: PerformanceConfig = {
  level: "medium",
  enableBlur: false, // Blur is expensive
  enableParticles: true,
  enableInfiniteAnimations: true,
  particleCount: 4,
  animationDuration: 0.25,
  springStiffness: 400,
  springDamping: 35,
};

const LOW_PERFORMANCE: PerformanceConfig = {
  level: "low",
  enableBlur: false,
  enableParticles: false,
  enableInfiniteAnimations: false,
  particleCount: 0,
  animationDuration: 0.15,
  springStiffness: 300,
  springDamping: 40,
};

function detectPerformanceLevel(): PerformanceLevel {
  if (typeof window === "undefined") return "medium";

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return "low";

  // Check device memory (Chrome only)
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (nav.deviceMemory !== undefined) {
    if (nav.deviceMemory <= 2) return "low";
    if (nav.deviceMemory <= 4) return "medium";
    return "high";
  }

  // Check hardware concurrency (CPU cores)
  if (navigator.hardwareConcurrency !== undefined) {
    if (navigator.hardwareConcurrency <= 2) return "low";
    if (navigator.hardwareConcurrency <= 4) return "medium";
    return "high";
  }

  // Check for older iOS devices by screen size and pixel ratio
  const isOlderIOS = /iPhone|iPad/.test(navigator.userAgent) && window.devicePixelRatio <= 2;
  if (isOlderIOS) return "medium";

  // Check for Android with low-end indicators
  const isLowEndAndroid = /Android/.test(navigator.userAgent) && 
    (window.innerWidth < 360 || window.devicePixelRatio < 2);
  if (isLowEndAndroid) return "low";

  // Default to medium for unknown devices
  return "medium";
}

export function usePerformance(): PerformanceConfig {
  const [config, setConfig] = useState<PerformanceConfig>(MEDIUM_PERFORMANCE);

  useEffect(() => {
    const level = detectPerformanceLevel();
    
    switch (level) {
      case "high":
        setConfig(HIGH_PERFORMANCE);
        break;
      case "low":
        setConfig(LOW_PERFORMANCE);
        break;
      default:
        setConfig(MEDIUM_PERFORMANCE);
    }
  }, []);

  return config;
}

// Optimized spring config based on performance level
export function useOptimizedSpring() {
  const perf = usePerformance();
  
  return {
    type: "spring" as const,
    stiffness: perf.springStiffness,
    damping: perf.springDamping,
  };
}

// Check if we should show blur effects
export function useShouldBlur(): boolean {
  const perf = usePerformance();
  return perf.enableBlur;
}

