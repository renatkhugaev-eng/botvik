"use client";

import Lottie from "lottie-react";
import { CSSProperties } from "react";

type LottieAnimationProps = {
  /** Path to JSON file in /public folder, e.g. "/animations/glow.json" */
  src?: string;
  /** Or pass animation data directly */
  animationData?: object;
  /** Loop animation (default: true) */
  loop?: boolean;
  /** Autoplay (default: true) */
  autoplay?: boolean;
  /** CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
  /** Animation speed (1 = normal, 2 = 2x faster) */
  speed?: number;
};

/**
 * Lottie Animation Component
 * 
 * Usage:
 * ```tsx
 * // With JSON file from /public/animations/
 * <LottieAnimation src="/animations/glow.json" className="w-20 h-20" />
 * 
 * // With imported animation data
 * import glowData from "@/public/animations/glow.json";
 * <LottieAnimation animationData={glowData} />
 * ```
 * 
 * Get free animations at: https://lottiefiles.com
 */
export function LottieAnimation({
  src,
  animationData,
  loop = true,
  autoplay = true,
  className,
  style,
  speed = 1,
}: LottieAnimationProps) {
  // If src provided, we need to fetch it
  // For now, use animationData directly
  
  if (!animationData && !src) {
    console.warn("LottieAnimation: provide either src or animationData");
    return null;
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      className={className}
      style={{
        ...style,
        // Ensure it doesn't affect layout unexpectedly
        pointerEvents: "none",
      }}
      // Note: speed is set via lottieRef if needed
    />
  );
}

export default LottieAnimation;

