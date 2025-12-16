"use client";

import { useEffect, useState } from "react";
import { onCLS, onLCP, onINP, onFCP, onTTFB } from "web-vitals";

type Metrics = {
  CLS: number | null;
  LCP: number | null;
  INP: number | null;
  FCP: number | null;
  TTFB: number | null;
};

/**
 * Web Vitals Overlay — shows real-time metrics in corner
 * Only visible when ?debug=vitals is in URL
 */
export function WebVitalsOverlay() {
  const [metrics, setMetrics] = useState<Metrics>({
    CLS: null,
    LCP: null,
    INP: null,
    FCP: null,
    TTFB: null,
  });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Set to true for debugging, false for production
    const DEBUG_ALWAYS_SHOW = false;
    
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (DEBUG_ALWAYS_SHOW || params.get("debug") === "vitals") {
        setVisible(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    onCLS((metric) => {
      setMetrics((m) => ({ ...m, CLS: metric.value }));
      console.log("[CLS]", metric.value, metric);
    });

    onLCP((metric) => {
      setMetrics((m) => ({ ...m, LCP: metric.value }));
      console.log("[LCP]", metric.value, "ms", metric);
    });

    onINP((metric) => {
      setMetrics((m) => ({ ...m, INP: metric.value }));
      console.log("[INP]", metric.value, "ms", metric);
    });

    onFCP((metric) => {
      setMetrics((m) => ({ ...m, FCP: metric.value }));
      console.log("[FCP]", metric.value, "ms", metric);
    });

    onTTFB((metric) => {
      setMetrics((m) => ({ ...m, TTFB: metric.value }));
      console.log("[TTFB]", metric.value, "ms", metric);
    });
  }, [visible]);

  if (!visible) return null;

  const getColor = (name: string, value: number | null) => {
    if (value === null) return "text-gray-400";
    
    const thresholds: Record<string, [number, number]> = {
      CLS: [0.1, 0.25],
      LCP: [2500, 4000],
      INP: [200, 500],
      FCP: [1800, 3000],
      TTFB: [800, 1800],
    };
    
    const [good, poor] = thresholds[name] || [0, 0];
    if (value <= good) return "text-green-400";
    if (value <= poor) return "text-yellow-400";
    return "text-red-400";
  };

  const formatValue = (name: string, value: number | null) => {
    if (value === null) return "—";
    if (name === "CLS") return value.toFixed(3);
    return `${Math.round(value)}ms`;
  };

  return (
    <div className="fixed bottom-20 right-2 z-[9999] bg-black/90 rounded-lg p-2 text-[10px] font-mono shadow-xl border border-white/20">
      <div className="text-white/50 mb-1 text-center">Web Vitals</div>
      {Object.entries(metrics).map(([name, value]) => (
        <div key={name} className="flex justify-between gap-3">
          <span className="text-white/70">{name}:</span>
          <span className={getColor(name, value)}>
            {formatValue(name, value)}
          </span>
        </div>
      ))}
      <div className="text-white/30 mt-1 text-[8px] text-center">
        Scroll to trigger CLS
      </div>
    </div>
  );
}

