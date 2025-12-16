"use client";

import { useEffect, useRef, useState } from "react";
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
 * Uses a lightweight check to avoid Rive internal "Bad header" errors.
 */
export function ParticlesRiveLayer({
  pause = false,
  src = "/rive/particles.riv",
  opacity = 0.6,
  artboard,
  stateMachine = "State Machine 1",
  className = "",
}: ParticlesRiveLayerProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [hasError, setHasError] = useState(false);
  const checkedRef = useRef(false);

  // Quick check if file exists and is valid (not empty/placeholder)
  // This prevents Rive from logging "Bad header" errors
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    fetch(src)
      .then((res) => {
        // Check if response is OK and content-length > 100 bytes (real .riv files are larger)
        const contentLength = res.headers.get("content-length");
        const isValidSize = contentLength ? parseInt(contentLength, 10) > 100 : true;
        
        if (res.ok && isValidSize) {
          setShouldRender(true);
        } else {
          if (process.env.NODE_ENV === "development") {
            console.info(`[ParticlesRiveLayer] Skipped: ${src} (not found or placeholder)`);
          }
        }
      })
      .catch(() => {
        // Silently ignore network errors
      });
  }, [src]);

  const { rive, RiveComponent } = useRive({
    src: shouldRender ? src : "", // Empty string prevents Rive from loading
    artboard,
    stateMachines: stateMachine,
    autoplay: !pause && shouldRender,
    layout: new Layout({
      fit: Fit.Cover,
      alignment: Alignment.Center,
    }),
    onLoadError: () => {
      setHasError(true);
    },
  });

  // Pause/play based on prop
  useEffect(() => {
    if (!rive || hasError) return;
    
    if (pause) {
      rive.pause();
    } else {
      rive.play();
    }
  }, [rive, pause, hasError]);

  // Don't render if not ready or error occurred
  if (!shouldRender || hasError) {
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
