/**
 * Telegram WebApp Type Definitions
 * 
 * Официальная документация: https://core.telegram.org/bots/webapps
 * 
 * Эти типы покрывают API Telegram Mini Apps для TypeScript
 */

// ═══════════════════════════════════════════════════════════════════════════
// ОСНОВНЫЕ ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

export interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

export interface TelegramWebAppChat {
  id: number;
  type: "group" | "supergroup" | "channel";
  title: string;
  username?: string;
  photo_url?: string;
}

export interface TelegramWebAppInitData {
  query_id?: string;
  user?: TelegramWebAppUser;
  receiver?: TelegramWebAppUser;
  chat?: TelegramWebAppChat;
  chat_type?: "sender" | "private" | "group" | "supergroup" | "channel";
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════════════════

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HAPTIC FEEDBACK
// ═══════════════════════════════════════════════════════════════════════════

export type HapticImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
export type HapticNotificationType = "error" | "success" | "warning";

export interface TelegramHapticFeedback {
  impactOccurred: (style: HapticImpactStyle) => void;
  notificationOccurred: (type: HapticNotificationType) => void;
  selectionChanged: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUTTONS
// ═══════════════════════════════════════════════════════════════════════════

export interface TelegramMainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => TelegramMainButton;
  onClick: (callback: () => void) => TelegramMainButton;
  offClick: (callback: () => void) => TelegramMainButton;
  show: () => TelegramMainButton;
  hide: () => TelegramMainButton;
  enable: () => TelegramMainButton;
  disable: () => TelegramMainButton;
  showProgress: (leaveActive?: boolean) => TelegramMainButton;
  hideProgress: () => TelegramMainButton;
  setParams: (params: {
    text?: string;
    color?: string;
    text_color?: string;
    is_active?: boolean;
    is_visible?: boolean;
  }) => TelegramMainButton;
}

export interface TelegramBackButton {
  isVisible: boolean;
  onClick: (callback: () => void) => TelegramBackButton;
  offClick: (callback: () => void) => TelegramBackButton;
  show: () => TelegramBackButton;
  hide: () => TelegramBackButton;
}

// ═══════════════════════════════════════════════════════════════════════════
// POPUPS
// ═══════════════════════════════════════════════════════════════════════════

export interface TelegramPopupButton {
  id?: string;
  type?: "default" | "ok" | "close" | "cancel" | "destructive";
  text?: string;
}

export interface TelegramPopupParams {
  title?: string;
  message: string;
  buttons?: TelegramPopupButton[];
}

export interface TelegramScanQrPopupParams {
  text?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD STORAGE
// ═══════════════════════════════════════════════════════════════════════════

export interface TelegramCloudStorage {
  setItem: (
    key: string,
    value: string,
    callback?: (error: Error | null, success?: boolean) => void
  ) => void;
  getItem: (
    key: string,
    callback: (error: Error | null, value?: string) => void
  ) => void;
  getItems: (
    keys: string[],
    callback: (error: Error | null, values?: Record<string, string>) => void
  ) => void;
  removeItem: (
    key: string,
    callback?: (error: Error | null, success?: boolean) => void
  ) => void;
  removeItems: (
    keys: string[],
    callback?: (error: Error | null, success?: boolean) => void
  ) => void;
  getKeys: (callback: (error: Error | null, keys?: string[]) => void) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// BIOMETRIC
// ═══════════════════════════════════════════════════════════════════════════

export interface TelegramBiometricManager {
  isInited: boolean;
  isBiometricAvailable: boolean;
  biometricType: "finger" | "face" | "unknown";
  isAccessRequested: boolean;
  isAccessGranted: boolean;
  isBiometricTokenSaved: boolean;
  deviceId: string;
  init: (callback?: () => void) => TelegramBiometricManager;
  requestAccess: (
    params: { reason?: string },
    callback?: (granted: boolean) => void
  ) => TelegramBiometricManager;
  authenticate: (
    params: { reason?: string },
    callback?: (success: boolean, token?: string) => void
  ) => TelegramBiometricManager;
  updateBiometricToken: (
    token: string,
    callback?: (updated: boolean) => void
  ) => TelegramBiometricManager;
  openSettings: () => TelegramBiometricManager;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN WEBAPP INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export type TelegramColorScheme = "light" | "dark";

export interface TelegramWebApp {
  // Данные инициализации
  initData: string;
  initDataUnsafe: TelegramWebAppInitData;
  
  // Версия и платформа
  version: string;
  platform: string;
  
  // Тема
  colorScheme: TelegramColorScheme;
  themeParams: TelegramThemeParams;
  
  // Размеры
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  
  // Состояние
  isClosingConfirmationEnabled: boolean;
  isVerticalSwipesEnabled: boolean;
  headerColor: string;
  backgroundColor: string;
  
  // Компоненты
  BackButton: TelegramBackButton;
  MainButton: TelegramMainButton;
  HapticFeedback: TelegramHapticFeedback;
  CloudStorage: TelegramCloudStorage;
  BiometricManager: TelegramBiometricManager;
  
  // Методы жизненного цикла
  ready: () => void;
  expand: () => void;
  close: () => void;
  
  // Методы навигации
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  enableVerticalSwipes: () => void;
  disableVerticalSwipes: () => void;
  
  // Методы темы
  setHeaderColor: (color: "bg_color" | "secondary_bg_color" | string) => void;
  setBackgroundColor: (color: "bg_color" | "secondary_bg_color" | string) => void;
  
  // Попапы
  showPopup: (
    params: TelegramPopupParams,
    callback?: (buttonId?: string) => void
  ) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showScanQrPopup: (
    params: TelegramScanQrPopupParams,
    callback?: (text: string) => boolean
  ) => void;
  closeScanQrPopup: () => void;
  
  // Данные
  sendData: (data: string) => void;
  
  // Шаринг
  switchInlineQuery: (query: string, chooseChatTypes?: string[]) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (
    url: string,
    callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void
  ) => void;
  shareToStory: (
    mediaUrl: string,
    params?: {
      text?: string;
      widget_link?: { url: string; name?: string };
    }
  ) => void;
  
  // Буфер обмена
  readTextFromClipboard: (callback?: (text: string | null) => void) => void;
  
  // Запросы
  requestWriteAccess: (callback?: (granted: boolean) => void) => void;
  requestContact: (callback?: (sent: boolean) => void) => void;
  
  // События
  onEvent: (eventType: string, eventHandler: () => void) => void;
  offEvent: (eventType: string, eventHandler: () => void) => void;
  
  // Валидация
  isVersionAtLeast: (version: string) => boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// ГЛОБАЛЬНОЕ РАСШИРЕНИЕ WINDOW
// ═══════════════════════════════════════════════════════════════════════════

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export {};

