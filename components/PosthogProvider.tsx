"use client";

import { useEffect } from "react";
import { initPosthog } from "@/lib/posthog";

/**
 * Posthog Provider Component
 * Initialize Posthog on app mount
 */
export function PosthogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPosthog();
  }, []);

  return <>{children}</>;
}

