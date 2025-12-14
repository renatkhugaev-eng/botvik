"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, createContext, useContext, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type NotificationType = 
  | "level_up" 
  | "energy_full" 
  | "achievement" 
  | "leaderboard" 
  | "friend"
  | "info"
  | "success"
  | "error";

export interface InAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  duration?: number; // ms, default 4000
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ═══════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════

interface NotificationContextValue {
  notifications: InAppNotification[];
  showNotification: (notification: Omit<InAppNotification, "id">) => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

  const showNotification = useCallback((notification: Omit<InAppNotification, "id">) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newNotification: InAppNotification = {
      ...notification,
      id,
      duration: notification.duration ?? 4000,
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto dismiss
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, newNotification.duration);
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, showNotification, dismissNotification, clearAll }}
    >
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION CONTAINER
// ═══════════════════════════════════════════════════════════════════

function NotificationContainer() {
  const { notifications, dismissNotification } = useNotifications();

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none p-4 flex flex-col items-center gap-3">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={() => dismissNotification(notification.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION TOAST
// ═══════════════════════════════════════════════════════════════════

const TYPE_STYLES: Record<NotificationType, { bg: string; border: string; icon: string }> = {
  level_up: {
    bg: "bg-gradient-to-r from-amber-500/20 to-yellow-500/20",
    border: "border-amber-500/40",
    icon: "🎉",
  },
  energy_full: {
    bg: "bg-gradient-to-r from-green-500/20 to-emerald-500/20",
    border: "border-green-500/40",
    icon: "⚡",
  },
  achievement: {
    bg: "bg-gradient-to-r from-purple-500/20 to-violet-500/20",
    border: "border-purple-500/40",
    icon: "🏆",
  },
  leaderboard: {
    bg: "bg-gradient-to-r from-blue-500/20 to-cyan-500/20",
    border: "border-blue-500/40",
    icon: "📊",
  },
  friend: {
    bg: "bg-gradient-to-r from-pink-500/20 to-rose-500/20",
    border: "border-pink-500/40",
    icon: "👥",
  },
  info: {
    bg: "bg-gradient-to-r from-slate-500/20 to-gray-500/20",
    border: "border-slate-500/40",
    icon: "ℹ️",
  },
  success: {
    bg: "bg-gradient-to-r from-green-500/20 to-emerald-500/20",
    border: "border-green-500/40",
    icon: "✅",
  },
  error: {
    bg: "bg-gradient-to-r from-red-500/20 to-rose-500/20",
    border: "border-red-500/40",
    icon: "❌",
  },
};

function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: InAppNotification;
  onDismiss: () => void;
}) {
  const style = TYPE_STYLES[notification.type];
  const icon = notification.icon || style.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`
        pointer-events-auto w-full max-w-sm
        ${style.bg} backdrop-blur-xl
        border ${style.border}
        rounded-2xl shadow-2xl shadow-black/30
        overflow-hidden
      `}
      onClick={onDismiss}
    >
      {/* Progress bar */}
      {notification.duration && notification.duration > 0 && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: notification.duration / 1000, ease: "linear" }}
          className="absolute top-0 left-0 right-0 h-0.5 bg-white/30 origin-left"
        />
      )}

      <div className="p-4 flex items-start gap-3">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", delay: 0.1 }}
          className="text-2xl flex-shrink-0"
        >
          {icon}
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="font-bold text-white text-sm"
          >
            {notification.title}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="text-white/70 text-xs mt-0.5 line-clamp-2"
          >
            {notification.message}
          </motion.p>
          
          {/* Action button */}
          {notification.action && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              onClick={(e) => {
                e.stopPropagation();
                notification.action?.onClick();
                onDismiss();
              }}
              className="mt-2 px-3 py-1 text-xs font-semibold rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              {notification.action.label}
            </motion.button>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HELPER HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Hook to show common notification types
 */
export function useNotify() {
  const { showNotification } = useNotifications();

  return {
    levelUp: (level: number, title?: string) => {
      showNotification({
        type: "level_up",
        title: `Уровень ${level}!`,
        message: title ? `Новый титул: ${title}` : "Продолжай в том же духе!",
        duration: 5000,
      });
    },

    energyFull: () => {
      showNotification({
        type: "energy_full",
        title: "Энергия восстановлена!",
        message: "Можно снова играть",
        duration: 4000,
      });
    },

    achievement: (name: string, description: string) => {
      showNotification({
        type: "achievement",
        title: name,
        message: description,
        icon: "🏆",
        duration: 5000,
      });
    },

    leaderboardUp: (position: number) => {
      showNotification({
        type: "leaderboard",
        title: "Рейтинг повысился!",
        message: `Ты теперь на #${position} месте`,
        icon: "📈",
        duration: 4000,
      });
    },

    leaderboardDown: (position: number) => {
      showNotification({
        type: "leaderboard",
        title: "Тебя обогнали!",
        message: `Теперь ты на #${position} месте`,
        icon: "📉",
        duration: 4000,
      });
    },

    friendActivity: (friendName: string, action: string) => {
      showNotification({
        type: "friend",
        title: friendName,
        message: action,
        duration: 4000,
      });
    },

    success: (title: string, message: string) => {
      showNotification({
        type: "success",
        title,
        message,
        duration: 3000,
      });
    },

    error: (title: string, message: string) => {
      showNotification({
        type: "error",
        title,
        message,
        duration: 5000,
      });
    },

    info: (title: string, message: string) => {
      showNotification({
        type: "info",
        title,
        message,
        duration: 3000,
      });
    },

    custom: showNotification,
  };
}

