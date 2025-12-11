/**
 * Telegram WebApp Haptic Feedback Utilities
 * 
 * Provides pleasant tactile feedback through device vibration
 * Only works within Telegram Mini App environment
 */

// Types for Telegram WebApp HapticFeedback
type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type NotificationType = "error" | "success" | "warning";

interface HapticFeedback {
  impactOccurred: (style: ImpactStyle) => void;
  notificationOccurred: (type: NotificationType) => void;
  selectionChanged: () => void;
}

// Get Telegram WebApp HapticFeedback object safely
function getHapticFeedback(): HapticFeedback | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tg = (window as any).Telegram?.WebApp;
  return tg?.HapticFeedback ?? null;
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
    getHapticFeedback()?.impactOccurred("light");
  },

  /**
   * Medium impact - for standard interactions
   * Use for: button presses, card selections
   */
  medium: () => {
    getHapticFeedback()?.impactOccurred("medium");
  },

  /**
   * Heavy impact - for important actions
   * Use for: confirmations, major actions, navigation
   */
  heavy: () => {
    getHapticFeedback()?.impactOccurred("heavy");
  },

  /**
   * Soft impact - gentle feedback
   * Use for: soft buttons, floating elements
   */
  soft: () => {
    getHapticFeedback()?.impactOccurred("soft");
  },

  /**
   * Rigid impact - sharp, crisp feedback
   * Use for: toggles, switches, precise controls
   */
  rigid: () => {
    getHapticFeedback()?.impactOccurred("rigid");
  },

  /**
   * Selection changed - for list selections
   * Use for: scrolling through options, picker changes
   */
  selection: () => {
    getHapticFeedback()?.selectionChanged();
  },

  /**
   * Success notification
   * Use for: completed actions, achievements
   */
  success: () => {
    getHapticFeedback()?.notificationOccurred("success");
  },

  /**
   * Warning notification
   * Use for: alerts, confirmations needed
   */
  warning: () => {
    getHapticFeedback()?.notificationOccurred("warning");
  },

  /**
   * Error notification
   * Use for: failed actions, errors
   */
  error: () => {
    getHapticFeedback()?.notificationOccurred("error");
  },
};

/**
 * React hook for haptic feedback
 * Returns memoized haptic functions
 */
export function useHaptic() {
  return haptic;
}
