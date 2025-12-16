"use client";

import { useEffect, useRef } from "react";
import { useRive, Layout, Fit, Alignment } from "@rive-app/react-canvas";

type ParticlesRiveLayerProps = {
  /** Pause the animation (e.g., during scroll) */
  pause?: boolean;
  /** Path to .riv file */
  src?: string;
  /** Opacity of the layer */
  opacity?: number;
  /** Artboard name in the .riv file */
  artboard?: string;
  /** State machine name */
  stateMachine?: string;
  /** CSS class for positioning */
  className?: string;
};

/**
 * GPU-accelerated particle effect layer using Rive.
 * Renders as a single canvas element, much more performant than DOM particles.
 * 
 * Position this as an absolute layer UNDER your UI content.
 * 
 * If the .riv file is missing or fails to load, component renders nothing.
 * No HEAD requests, no retries — just direct Rive initialization.
 */
export function ParticlesRiveLayer({
  pause = false,
  src = "/rive/particles.riv",
  opacity = 0.6,
  artboard,
  stateMachine = "State Machine 1",
  className = "",
}: ParticlesRiveLayerProps) {
  const hasErrorRef = useRef(false);
  const warnedRef = useRef(false);

  const { rive, RiveComponent } = useRive({
    src,
    artboard,
    stateMachines: stateMachine,
    autoplay: !pause,
    layout: new Layout({
      fit: Fit.Cover,
      alignment: Alignment.Center,
    }),
    onLoadError: () => {
      hasErrorRef.current = true;
      // Warn once in development only
      if (process.env.NODE_ENV === "development" && !warnedRef.current) {
        warnedRef.current = true;
        console.warn(`[ParticlesRiveLayer] Failed to load: ${src}`);
      }
    },
  });

  // Pause/play based on prop
  useEffect(() => {
    if (!rive) return;
    
    if (pause) {
      rive.pause();
    } else {
      rive.play();
    }
  }, [rive, pause]);

  // Don't render if error occurred
  if (hasErrorRef.current) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-0 ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <RiveComponent className="w-full h-full" />
    </div>
  );
}

export default ParticlesRiveLayer;
