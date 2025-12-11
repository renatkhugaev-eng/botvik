/**
 * Telegram WebApp Haptic Feedback Utilities
 * 
 * Provides pleasant tactile feedback through device vibration
 * Only works within Telegram Mini App environment
 */

// Get Telegram WebApp object safely
function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as WindowWithTelegram).Telegram?.WebApp ?? null;
}

// Types for Telegram WebApp
type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type NotificationType = "error" | "success" | "warning";

interface HapticFeedback {
  impactOccurred: (style: ImpactStyle) => void;
  notificationOccurred: (type: NotificationType) => void;
  selectionChanged: () => void;
}

interface TelegramWebApp {
  HapticFeedback: HapticFeedback;
}

interface WindowWithTelegram extends Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}

/**
 * Haptic feedback functions
 */
export const haptic = {
  /**
   * Light impact - for subtle interactions
   * Use for: tab switches, toggles, minor selections
   */
  light: () => {
    getTelegramWebApp()?.HapticFeedback.impactOccurred("light");
  },

  /**
   * Medium impact - for standard interactions
   * Use for: button presses, card selections
   */
  medium: () => {
    getTelegramWebApp()?.HapticFeedback.impactOccurred("medium");
  },

  /**
   * Heavy impact - for important actions
   * Use for: confirmations, major actions, navigation
   */
  heavy: () => {
    getTelegramWebApp()?.HapticFeedback.impactOccurred("heavy");
  },

  /**
   * Soft impact - gentle feedback
   * Use for: soft buttons, floating elements
   */
  soft: () => {
    getTelegramWebApp()?.HapticFeedback.impactOccurred("soft");
  },

  /**
   * Rigid impact - sharp, crisp feedback
   * Use for: toggles, switches, precise controls
   */
  rigid: () => {
    getTelegramWebApp()?.HapticFeedback.impactOccurred("rigid");
  },

  /**
   * Selection changed - for list selections
   * Use for: scrolling through options, picker changes
   */
  selection: () => {
    getTelegramWebApp()?.HapticFeedback.selectionChanged();
  },

  /**
   * Success notification
   * Use for: completed actions, achievements
   */
  success: () => {
    getTelegramWebApp()?.HapticFeedback.notificationOccurred("success");
  },

  /**
   * Warning notification
   * Use for: alerts, confirmations needed
   */
  warning: () => {
    getTelegramWebApp()?.HapticFeedback.notificationOccurred("warning");
  },

  /**
   * Error notification
   * Use for: failed actions, errors
   */
  error: () => {
    getTelegramWebApp()?.HapticFeedback.notificationOccurred("error");
  },
};

/**
 * React hook for haptic feedback
 * Returns memoized haptic functions
 */
export function useHaptic() {
  return haptic;
}

