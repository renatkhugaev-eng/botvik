"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Device Performance Tier Detection with Automatic Jank Monitoring
 * 
 * Determines device capability tier for adaptive performance optimization
 * in Telegram WebView (iOS/Android).
 * 
 * DETECTION SIGNALS:
 * - navigator.deviceMemory: RAM in GB (Chrome/Edge only, ≤4GB = low)
 * - navigator.hardwareConcurrency: CPU cores (≤4 = low)
 * - prefers-reduced-motion: User preference for less motion
 * - userAgent heuristics: Known low-end Android devices/versions
 * 
 * RUNTIME JANK DETECTION:
 * - PerformanceObserver "longtask": Any task >120ms = jank++
 * - requestAnimationFrame fallback: Frame delta >50ms = jank++ (frame drop)
 * - If jank >= 5 within 10s of active scroll → downgrade to "low"
 * - 2s warmup period on page load (no downgrade during initial render)
 * 
 * DEBUG MODE:
 * Add ?debugPerf=1 to URL to show overlay with tier, reasons, jankCount
 * 
 * USAGE:
 * const { tier, config, jankCount } = useDeviceTier();
 * <ParticlesRiveLayer opacity={config.riveOpacityHome} />
 */

export type DeviceTier = "low" | "mid" | "high";

export type PerfConfig = {
  scrollDebounceMs: number;
  riveOpacityHome: number;
  riveOpacityInner: number;
  allowBackdropFilter: boolean;
  maxBlurLevel: "none" | "sm" | "md" | "lg" | "xl";
};

export type DeviceTierInfo = {
  tier: DeviceTier;
  reasons: string[];
  config: PerfConfig;
  jankCount: number;
};

// Performance configs by tier
const PERF_CONFIGS: Record<DeviceTier, PerfConfig> = {
  low: {
    scrollDebounceMs: 240,
    riveOpacityHome: 0.38,
    riveOpacityInner: 0.34,
    allowBackdropFilter: false,
    maxBlurLevel: "none",
  },
  mid: {
    scrollDebounceMs: 180,
    riveOpacityHome: 0.45,
    riveOpacityInner: 0.40,
    allowBackdropFilter: true,
    maxBlurLevel: "md",
  },
  high: {
    scrollDebounceMs: 140,
    riveOpacityHome: 0.50,
    riveOpacityInner: 0.45,
    allowBackdropFilter: true,
    maxBlurLevel: "xl",
  },
};

// Known low-end Android patterns
const LOW_END_UA_PATTERNS = [
  /Android [4-7]\./i,           // Android 4-7 (old versions)
  /SM-J\d/i,                    // Samsung Galaxy J series
  /SM-A[0-2]\d/i,               // Samsung Galaxy A0x-A2x (budget)
  /Redmi [4-7]/i,               // Xiaomi Redmi 4-7
  /POCO [CM]/i,                 // POCO budget line
  /realme [1-5]/i,              // Realme 1-5
  /OPPO A[0-5]/i,               // OPPO A0x-A5x
  /vivo Y/i,                    // Vivo Y series (budget)
  /Nokia [1-4]/i,               // Nokia 1-4
  /Infinix/i,                   // Infinix (budget brand)
  /Tecno/i,                     // Tecno (budget brand)
];

// Constants
const SESSION_STORAGE_KEY = "device_tier_override";
const JANK_THRESHOLD = 5;           // Downgrade after 5 jank events
const JANK_WINDOW_MS = 10_000;      // Within 10 seconds
const LONGTASK_THRESHOLD_MS = 120;  // Longtask > 120ms = jank
const FRAME_DROP_THRESHOLD_MS = 50; // Frame delta > 50ms = frame drop
const WARMUP_MS = 2000;             // Don't count jank for first 2s

/**
 * Detect device tier based on multiple signals
 */
function detectTier(): { tier: DeviceTier; reasons: string[] } {
  if (typeof window === "undefined") {
    return { tier: "mid", reasons: ["ssr"] };
  }

  const reasons: string[] = [];
  let score = 0; // Higher = better device

  // Check sessionStorage override first
  try {
    const override = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (override === "low") {
      return { tier: "low", reasons: ["runtime:jank"] };
    }
  } catch {
    // sessionStorage not available
  }

  // 1. Device Memory (Chrome/Edge only)
  const memory = (navigator as any).deviceMemory as number | undefined;
  if (memory !== undefined) {
    if (memory <= 2) {
      score -= 2;
      reasons.push(`memory:${memory}GB`);
    } else if (memory <= 4) {
      score -= 1;
      reasons.push(`memory:${memory}GB`);
    } else if (memory >= 8) {
      score += 1;
      reasons.push(`memory:${memory}GB`);
    }
  }

  // 2. Hardware Concurrency (CPU cores)
  const cores = navigator.hardwareConcurrency;
  if (cores !== undefined) {
    if (cores <= 2) {
      score -= 2;
      reasons.push(`cores:${cores}`);
    } else if (cores <= 4) {
      score -= 1;
      reasons.push(`cores:${cores}`);
    } else if (cores >= 8) {
      score += 1;
      reasons.push(`cores:${cores}`);
    }
  }

  // 3. Prefers Reduced Motion
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    score -= 1;
    reasons.push("prefers-reduced-motion");
  }

  // 4. User Agent heuristics (known low-end devices)
  const ua = navigator.userAgent;
  for (const pattern of LOW_END_UA_PATTERNS) {
    if (pattern.test(ua)) {
      score -= 1;
      reasons.push(`ua:${pattern.source.slice(0, 20)}`);
      break; // Only count once
    }
  }

  // 5. Check for iOS (generally better WebView perf)
  if (/iPhone|iPad/.test(ua)) {
    score += 1;
    reasons.push("ios");
  }

  // Determine tier from score
  let tier: DeviceTier;
  if (score <= -2) {
    tier = "low";
  } else if (score >= 2) {
    tier = "high";
  } else {
    tier = "mid";
  }

  return { tier, reasons };
}

/**
 * Get performance config for a specific tier
 */
export function getPerfConfig(tier: DeviceTier): PerfConfig {
  return PERF_CONFIGS[tier];
}

/**
 * Hook to detect device performance tier with automatic jank monitoring
 */
export function useDeviceTier(): DeviceTierInfo {
  const [info, setInfo] = useState<DeviceTierInfo>(() => {
    const { tier, reasons } = detectTier();
    return { tier, reasons, config: getPerfConfig(tier), jankCount: 0 };
  });

  const jankTimestamps = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(0);
  const mountTime = useRef<number>(Date.now());
  const isDowngraded = useRef(false);
  const rafId = useRef<number | null>(null);
  const debugMode = useRef(false);

  // Check for debug mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      debugMode.current = new URLSearchParams(window.location.search).has("debugPerf");
    }
  }, []);

  // Record jank event and check for downgrade
  const recordJank = useCallback((source: string) => {
    if (typeof window === "undefined") return;
    if (isDowngraded.current) return;
    
    // Skip during warmup period
    if (Date.now() - mountTime.current < WARMUP_MS) return;

    const now = Date.now();
    jankTimestamps.current.push(now);
    
    // Remove old timestamps outside window
    jankTimestamps.current = jankTimestamps.current.filter(
      t => now - t < JANK_WINDOW_MS
    );

    const count = jankTimestamps.current.length;

    // Update jankCount for debug
    setInfo(prev => ({ ...prev, jankCount: count }));

    // Check for downgrade
    if (count >= JANK_THRESHOLD) {
      isDowngraded.current = true;
      
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, "low");
      } catch {
        // sessionStorage not available
      }

      console.log(`[DeviceTier] Downgraded to low due to jank (${source})`);
      
      setInfo({
        tier: "low",
        reasons: ["runtime:jank", source],
        config: getPerfConfig("low"),
        jankCount: count,
      });
    }
  }, []);

  // Setup PerformanceObserver for longtask
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof PerformanceObserver === "undefined") return;

    let observer: PerformanceObserver | null = null;

    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > LONGTASK_THRESHOLD_MS) {
            recordJank(`longtask:${Math.round(entry.duration)}ms`);
          }
        }
      });

      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // PerformanceObserver not supported for longtask
    }

    return () => {
      observer?.disconnect();
    };
  }, [recordJank]);

  // Setup requestAnimationFrame frame drop detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isDowngraded.current) return;

    let running = true;
    lastFrameTime.current = performance.now();

    const checkFrame = (now: number) => {
      if (!running) return;

      const delta = now - lastFrameTime.current;
      lastFrameTime.current = now;

      // Skip first frame and warmup period
      if (delta > 0 && delta < 1000 && Date.now() - mountTime.current > WARMUP_MS) {
        if (delta > FRAME_DROP_THRESHOLD_MS) {
          recordJank(`framedrop:${Math.round(delta)}ms`);
        }
      }

      rafId.current = requestAnimationFrame(checkFrame);
    };

    rafId.current = requestAnimationFrame(checkFrame);

    return () => {
      running = false;
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [recordJank]);

  // Initial detection
  useEffect(() => {
    const { tier, reasons } = detectTier();
    setInfo(prev => ({
      ...prev,
      tier,
      reasons,
      config: getPerfConfig(tier),
    }));

    if (process.env.NODE_ENV === "development") {
      console.log(`[DeviceTier] tier=${tier}`, reasons);
    }
  }, []);

  // Debug overlay
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!debugMode.current) return;

    const createOverlay = () => {
      let overlay = document.getElementById("perf-debug-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "perf-debug-overlay";
        overlay.style.cssText = `
          position: fixed;
          bottom: 10px;
          left: 10px;
          background: rgba(0,0,0,0.85);
          color: #0f0;
          font-family: monospace;
          font-size: 11px;
          padding: 8px 12px;
          border-radius: 6px;
          z-index: 99999;
          pointer-events: none;
          max-width: 200px;
          line-height: 1.4;
        `;
        document.body.appendChild(overlay);
      }
      return overlay;
    };

    const updateOverlay = () => {
      const overlay = createOverlay();
      const tierColor = info.tier === "low" ? "#f00" : info.tier === "mid" ? "#ff0" : "#0f0";
      overlay.innerHTML = `
        <div style="color:${tierColor};font-weight:bold">TIER: ${info.tier.toUpperCase()}</div>
        <div>jank: ${info.jankCount}/${JANK_THRESHOLD}</div>
        <div style="font-size:9px;opacity:0.7">${info.reasons.join(", ")}</div>
      `;
    };

    updateOverlay();

    return () => {
      const overlay = document.getElementById("perf-debug-overlay");
      overlay?.remove();
    };
  }, [info]);

  return info;
}

export default useDeviceTier;
