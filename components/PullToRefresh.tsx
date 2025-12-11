"use client";

import { ReactNode } from "react";

type PullToRefreshProps = {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
};

/**
 * Simple wrapper that just passes through children
 * Pull-to-refresh gesture removed due to conflicts with Telegram Mini App scrolling
 */
export function PullToRefresh({ children }: PullToRefreshProps) {
  return <>{children}</>;
}
