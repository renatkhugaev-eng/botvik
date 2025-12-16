"use client";

import { useEffect, useState } from "react";
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
 */
export function ParticlesRiveLayer({
  pause = false,
  src = "/rive/particles.riv",
  opacity = 0.6,
  artboard,
  stateMachine = "State Machine 1",
  className = "",
}: ParticlesRiveLayerProps) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Check if .riv file exists
  useEffect(() => {
    fetch(src, { method: "HEAD" })
      .then((res) => {
        setIsAvailable(res.ok);
        if (!res.ok) {
          console.warn(`[ParticlesRiveLayer] File not found: ${src}`);
        }
      })
      .catch(() => {
        setIsAvailable(false);
        console.warn(`[ParticlesRiveLayer] Failed to check file: ${src}`);
      });
  }, [src]);

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
      setHasError(true);
      console.warn(`[ParticlesRiveLayer] Failed to load: ${src}`);
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

  // Don't render if file not available or error
  if (!isAvailable || hasError) {
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

