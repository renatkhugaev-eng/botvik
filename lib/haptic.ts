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
 * ═══════════════════════════════════════════════════════════════
 * INVESTIGATION-SPECIFIC HAPTIC PATTERNS
 * Designed for immersive detective experience in Telegram Mini App
 * ═══════════════════════════════════════════════════════════════
 */

export const investigationHaptic = {
  /**
   * Clue discovered - signature double tap
   * Creates anticipation and reward feeling
   */
  clueDiscovered: () => {
    const hf = getHapticFeedback();
    if (!hf) return;
    
    // First light tap - attention
    hf.impactOccurred("light");
    
    // Second heavier tap after short delay - reward
    setTimeout(() => {
      hf.impactOccurred("heavy");
    }, 100);
  },

  /**
   * Connection made - success with buildup
   * For linking evidence on the board
   */
  connectionMade: () => {
    const hf = getHapticFeedback();
    if (!hf) return;
    
    // Quick soft tap
    hf.impactOccurred("soft");
    
    // Success notification
    setTimeout(() => {
      hf.notificationOccurred("success");
    }, 80);
  },

  /**
   * Wrong connection - subtle discouragement
   * Softer than standard error to not frustrate
   */
  connectionFailed: () => {
    const hf = getHapticFeedback();
    if (!hf) return;
    
    // Two quick rigid taps - "nope"
    hf.impactOccurred("rigid");
    setTimeout(() => {
      hf.impactOccurred("rigid");
    }, 60);
  },

  /**
   * Dramatic moment - tension builder
   * For story reveals, suspense scenes
   */
  dramaticMoment: () => {
    const hf = getHapticFeedback();
    if (!hf) return;
    
    // Slow heavy pulse
    hf.impactOccurred("heavy");
  },

  /**
   * Suspense buildup - escalating pattern
   * For horror/tension scenes in story
   */
  suspense: () => {
    const hf = getHapticFeedback();
    if (!hf) return;
    
    // Three escalating taps
    hf.impactOccurred("light");
    setTimeout(() => hf.impactOccurred("medium"), 150);
    setTimeout(() => hf.impactOccurred("heavy"), 300);
  },

  /**
   * Scene transition - soft transition feel
   * When moving between story sections
   */
  sceneTransition: () => {
    const hf = getHapticFeedback();
    if (!hf) return;
    
    hf.impactOccurred("soft");
  },

  /**
   * Choice made - confirmation
   * When player selects a story choice
   */
  choiceMade: () => {
    const hf = getHapticFeedback();
    if (!hf) return;
    
    hf.impactOccurred("medium");
  },

  /**
   * New suspect revealed
   * Important discovery moment
   */
  suspectRevealed: () => {
    const hf = getHapticFeedback();
    if (!hf) return;
    
    // Warning-like pattern - attention-grabbing
    hf.notificationOccurred("warning");
    setTimeout(() => {
      hf.impactOccurred("heavy");
    }, 150);
  },

  /**
   * Insight gained - "aha!" moment
   * When player makes a correct deduction
   */
  insight: () => {
    const hf = getHapticFeedback();
    if (!hf) return;
    
    // Light buildup to success
    hf.impactOccurred("light");
    setTimeout(() => {
      hf.notificationOccurred("success");
    }, 100);
  },

  /**
   * Evidence select/deselect - tactile feedback
   * For touching evidence cards
   */
  evidenceSelect: () => {
    getHapticFeedback()?.impactOccurred("light");
  },

  /**
   * Evidence inspect - opening detail view
   * Long press on evidence
   */
  evidenceInspect: () => {
    getHapticFeedback()?.impactOccurred("medium");
  },

  /**
   * Board tab switch
   * Navigation between board sections
   */
  boardTabSwitch: () => {
    getHapticFeedback()?.selectionChanged();
  },

  /**
   * Case solved - celebration
   * Final success moment
   */
  caseSolved: () => {
    const hf = getHapticFeedback();
    if (!hf) return;
    
    // Triple success pulse
    hf.notificationOccurred("success");
    setTimeout(() => hf.impactOccurred("heavy"), 200);
    setTimeout(() => hf.notificationOccurred("success"), 400);
  },

  /**
   * Timer warning - urgency
   * For timed sections
   */
  timerWarning: () => {
    const hf = getHapticFeedback();
    if (!hf) return;
    
    // Rapid double warning
    hf.notificationOccurred("warning");
    setTimeout(() => hf.impactOccurred("rigid"), 100);
  },

  /**
   * Text reveal - subtle typewriter feel
   * For important text appearing
   */
  textReveal: () => {
    getHapticFeedback()?.impactOccurred("soft");
  },

  /**
   * Error/Game over
   * Dramatic failure
   */
  gameOver: () => {
    const hf = getHapticFeedback();
    if (!hf) return;
    
    hf.notificationOccurred("error");
    setTimeout(() => hf.impactOccurred("heavy"), 150);
  },
};

/**
 * React hook for haptic feedback
 * Returns memoized haptic functions
 */
export function useHaptic() {
  return haptic;
}

/**
 * React hook for investigation-specific haptics
 */
export function useInvestigationHaptic() {
  return investigationHaptic;
}
