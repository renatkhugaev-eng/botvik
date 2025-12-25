"use client";

/**
 * ResponsiveContainer - Адаптивный контейнер для всех устройств
 * 
 * Функции:
 * - Автоматические safe area insets
 * - Container queries для вложенных компонентов
 * - Адаптация под keyboard
 * - Поддержка всех ОС (iOS, Android, Desktop)
 */

import React, { forwardRef, HTMLAttributes, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useDeviceCSSVariables, useDeviceInfo } from "@/lib/useDeviceInfo";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type ResponsiveContainerProps = HTMLAttributes<HTMLDivElement> & {
  /** Включить safe area padding */
  safeArea?: boolean | "top" | "bottom" | "x" | "y" | "all";
  
  /** Максимальная ширина контента */
  maxWidth?: "content" | "lg" | "xl" | "full";
  
  /** Центрировать контент */
  centered?: boolean;
  
  /** Включить container queries */
  containerQuery?: boolean;
  
  /** Имя контейнера для container queries */
  containerName?: string;
  
  /** Скрывать при видимой клавиатуре */
  hideOnKeyboard?: boolean;
  
  /** Адаптивный padding */
  responsivePadding?: boolean;
  
  /** Минимальная высота */
  minHeight?: "full" | "available" | "screen" | "auto";
  
  /** Scrollable content */
  scrollable?: boolean;
  
  /** Высота = доступный viewport (без keyboard) */
  fillAvailable?: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ResponsiveContainer = forwardRef<HTMLDivElement, ResponsiveContainerProps>(
  (
    {
      children,
      className,
      safeArea = false,
      maxWidth = "full",
      centered = false,
      containerQuery = true,
      containerName,
      hideOnKeyboard = false,
      responsivePadding = false,
      minHeight = "auto",
      scrollable = false,
      fillAvailable = false,
      ...props
    },
    ref
  ) => {
    // Устанавливаем CSS переменные
    useDeviceCSSVariables();
    
    // Получаем информацию об устройстве
    const device = useDeviceInfo();

    // Устанавливаем data-атрибуты на html
    useEffect(() => {
      if (typeof document === "undefined") return;
      
      const root = document.documentElement;
      root.dataset.device = device.type;
      root.dataset.os = device.os;
      root.dataset.keyboardVisible = device.isKeyboardVisible ? "true" : "false";
      root.dataset.orientation = device.orientation;
      
      // Класс для Telegram Mini App
      if (device.isTelegramMiniApp) {
        root.classList.add("telegram-miniapp");
      }
    }, [device]);

    // Классы для safe area
    const safeAreaClasses = (() => {
      if (!safeArea) return "";
      if (safeArea === true || safeArea === "all") return "safe-all";
      if (safeArea === "top") return "safe-top";
      if (safeArea === "bottom") return "safe-bottom";
      if (safeArea === "x") return "safe-x";
      if (safeArea === "y") return "safe-y";
      return "";
    })();

    // Классы для max-width
    const maxWidthClasses = (() => {
      if (maxWidth === "content") return "max-w-content";
      if (maxWidth === "lg") return "max-w-content-lg";
      if (maxWidth === "xl") return "max-w-content-xl";
      return "";
    })();

    // Классы для min-height
    const minHeightClasses = (() => {
      if (minHeight === "full") return "min-h-full";
      if (minHeight === "available") return "min-h-available";
      if (minHeight === "screen") return "min-h-screen";
      return "";
    })();

    return (
      <div
        ref={ref}
        data-container={containerQuery ? "" : undefined}
        style={containerName ? { containerName } : undefined}
        className={cn(
          // Base
          "relative w-full",
          
          // Safe area
          safeAreaClasses,
          
          // Max width
          maxWidthClasses,
          
          // Centered
          centered && "mx-auto",
          
          // Container queries
          containerQuery && "container-responsive",
          
          // Hide on keyboard
          hideOnKeyboard && "hide-on-keyboard",
          
          // Responsive padding
          responsivePadding && "p-responsive",
          
          // Min height
          minHeightClasses,
          
          // Fill available height
          fillAvailable && "h-available",
          
          // Scrollable
          scrollable && "overflow-y-auto overflow-x-hidden overscroll-contain scrollable-content",
          
          // Custom classes
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ResponsiveContainer.displayName = "ResponsiveContainer";

// ═══════════════════════════════════════════════════════════════════════════
// SPECIALIZED CONTAINERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PageContainer - Контейнер для страницы с safe area и scroll
 */
export const PageContainer = forwardRef<
  HTMLDivElement,
  Omit<ResponsiveContainerProps, "safeArea" | "scrollable" | "fillAvailable">
>(({ children, className, ...props }, ref) => (
  <ResponsiveContainer
    ref={ref}
    safeArea="all"
    scrollable
    fillAvailable
    responsivePadding
    maxWidth="content"
    centered
    className={cn("flex flex-col", className)}
    {...props}
  >
    {children}
  </ResponsiveContainer>
));

PageContainer.displayName = "PageContainer";

/**
 * CardContainer - Контейнер для карточки с container queries
 */
export const CardContainer = forwardRef<
  HTMLDivElement,
  Omit<ResponsiveContainerProps, "containerQuery" | "containerName">
>(({ children, className, ...props }, ref) => (
  <ResponsiveContainer
    ref={ref}
    containerQuery
    containerName="card"
    className={cn("rounded-responsive-lg", className)}
    {...props}
  >
    {children}
  </ResponsiveContainer>
));

CardContainer.displayName = "CardContainer";

/**
 * SectionContainer - Контейнер для секции
 */
export const SectionContainer = forwardRef<
  HTMLDivElement,
  Omit<ResponsiveContainerProps, "containerQuery" | "containerName" | "responsivePadding">
>(({ children, className, ...props }, ref) => (
  <ResponsiveContainer
    ref={ref}
    containerQuery
    containerName="section"
    responsivePadding
    className={cn("gap-responsive", className)}
    {...props}
  >
    {children}
  </ResponsiveContainer>
));

SectionContainer.displayName = "SectionContainer";

/**
 * BottomSheet - Контейнер для нижней панели с safe area
 */
export const BottomSheetContainer = forwardRef<
  HTMLDivElement,
  Omit<ResponsiveContainerProps, "safeArea" | "hideOnKeyboard"> & {
    /** Скрывать при клавиатуре */
    hideOnKeyboard?: boolean;
  }
>(({ children, className, hideOnKeyboard = true, ...props }, ref) => (
  <ResponsiveContainer
    ref={ref}
    safeArea="bottom"
    hideOnKeyboard={hideOnKeyboard}
    className={cn(
      "fixed bottom-0 left-0 right-0",
      "bg-background/95 backdrop-blur-lg",
      "border-t border-border/50",
      "p-responsive",
      className
    )}
    {...props}
  >
    {children}
  </ResponsiveContainer>
));

BottomSheetContainer.displayName = "BottomSheetContainer";

/**
 * HeaderContainer - Контейнер для header с safe area top
 */
export const HeaderContainer = forwardRef<
  HTMLDivElement,
  Omit<ResponsiveContainerProps, "safeArea">
>(({ children, className, ...props }, ref) => (
  <ResponsiveContainer
    ref={ref}
    safeArea="top"
    className={cn(
      "sticky top-0 z-50",
      "bg-background/95 backdrop-blur-lg",
      "border-b border-border/50",
      className
    )}
    {...props}
  >
    {children}
  </ResponsiveContainer>
));

HeaderContainer.displayName = "HeaderContainer";

// ═══════════════════════════════════════════════════════════════════════════
// DEVICE-SPECIFIC WRAPPERS
// ═══════════════════════════════════════════════════════════════════════════

type DeviceOnlyProps = {
  children: React.ReactNode;
};

/**
 * Показать только на мобильных
 */
export function MobileOnly({ children }: DeviceOnlyProps) {
  const { isMobile } = useDeviceInfo();
  if (!isMobile) return null;
  return <>{children}</>;
}

/**
 * Показать только на планшетах
 */
export function TabletOnly({ children }: DeviceOnlyProps) {
  const { isTablet } = useDeviceInfo();
  if (!isTablet) return null;
  return <>{children}</>;
}

/**
 * Показать только на десктопе
 */
export function DesktopOnly({ children }: DeviceOnlyProps) {
  const { isDesktop } = useDeviceInfo();
  if (!isDesktop) return null;
  return <>{children}</>;
}

/**
 * Показать на мобильных и планшетах
 */
export function TouchOnly({ children }: DeviceOnlyProps) {
  const { isDesktop } = useDeviceInfo();
  if (isDesktop) return null;
  return <>{children}</>;
}

/**
 * Показать только на iOS
 */
export function IOSOnly({ children }: DeviceOnlyProps) {
  const { isIOS } = useDeviceInfo();
  if (!isIOS) return null;
  return <>{children}</>;
}

/**
 * Показать только на Android
 */
export function AndroidOnly({ children }: DeviceOnlyProps) {
  const { isAndroid } = useDeviceInfo();
  if (!isAndroid) return null;
  return <>{children}</>;
}

export default ResponsiveContainer;

