"use client";

import { Component, type ReactNode } from "react";
import { motion } from "framer-motion";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * INK STORY ERROR BOUNDARY
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Ловит ошибки в ink-историях и показывает пользователю дружественное сообщение.
 * Best Practice 2025: Error Boundaries для изолированной обработки ошибок.
 */

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class InkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Логируем ошибку
    console.error("[InkErrorBoundary] Story error:", error);
    console.error("[InkErrorBoundary] Component stack:", errorInfo.componentStack);
    
    // Вызываем callback если есть
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Кастомный fallback если передан
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Дефолтный UI ошибки
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center"
        >
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">
            Ошибка загрузки истории
          </h2>
          <p className="text-white/60 text-sm mb-4 max-w-md">
            {this.state.error?.message || "Произошла непредвиденная ошибка при загрузке истории."}
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors font-medium"
            >
              Попробовать снова
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              Назад
            </button>
          </div>
          
          {/* Детали ошибки для разработки */}
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details className="mt-6 text-left w-full max-w-md">
              <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">
                Детали ошибки (dev)
              </summary>
              <pre className="mt-2 p-3 rounded-lg bg-black/50 text-xs text-red-400 overflow-auto max-h-40">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </motion.div>
      );
    }

    return this.props.children;
  }
}

export default InkErrorBoundary;
