// Цветные SVG иконки для замены эмодзи
// Используются вместо текстовых эмодзи для лучшего рендеринга на всех платформах

import React from "react";

interface IconProps {
  className?: string;
  size?: number | string;
}

// ⚡ Молния (энергия)
export function LightningIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path 
        d="M13 2L4.09 12.63C3.74 13.04 3.95 13.65 4.46 13.79L10.52 15.42C10.91 15.53 11.15 15.93 11.06 16.32L9.5 22L18.91 11.37C19.26 10.96 19.05 10.35 18.54 10.21L12.48 8.58C12.09 8.47 11.85 8.07 11.94 7.68L13 2Z" 
        fill="url(#lightning-gradient)"
      />
      <defs>
        <linearGradient id="lightning-gradient" x1="4" y1="2" x2="19" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 💎 Кристалл (очки)
export function DiamondIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 3H18L22 9L12 21L2 9L6 3Z" fill="url(#diamond-gradient-main)"/>
      <path d="M2 9H22L12 21L2 9Z" fill="url(#diamond-gradient-bottom)" opacity="0.9"/>
      <path d="M8 9L12 3L16 9L12 21L8 9Z" fill="url(#diamond-gradient-center)" opacity="0.7"/>
      <path d="M6 3L8 9H2L6 3Z" fill="url(#diamond-gradient-left)" opacity="0.8"/>
      <path d="M18 3L22 9H16L18 3Z" fill="url(#diamond-gradient-right)" opacity="0.8"/>
      <defs>
        <linearGradient id="diamond-gradient-main" x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E879F9"/>
          <stop offset="0.5" stopColor="#A855F7"/>
          <stop offset="1" stopColor="#7C3AED"/>
        </linearGradient>
        <linearGradient id="diamond-gradient-bottom" x1="12" y1="9" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C084FC"/>
          <stop offset="1" stopColor="#8B5CF6"/>
        </linearGradient>
        <linearGradient id="diamond-gradient-center" x1="12" y1="3" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F0ABFC"/>
          <stop offset="1" stopColor="#C084FC"/>
        </linearGradient>
        <linearGradient id="diamond-gradient-left" x1="2" y1="3" x2="8" y2="9" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E9D5FF"/>
          <stop offset="1" stopColor="#D8B4FE"/>
        </linearGradient>
        <linearGradient id="diamond-gradient-right" x1="16" y1="3" x2="22" y2="9" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E9D5FF"/>
          <stop offset="1" stopColor="#D8B4FE"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🏆 Кубок (топ/награда)
export function TrophyIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 15C15.866 15 19 12.09 19 8.5V4H5V8.5C5 12.09 8.134 15 12 15Z" fill="url(#trophy-gradient)"/>
      <path d="M5 4H3C2.45 4 2 4.45 2 5V7C2 8.66 3.34 10 5 10V4Z" fill="url(#trophy-handle-l)"/>
      <path d="M19 4H21C21.55 4 22 4.45 22 5V7C22 8.66 20.66 10 19 10V4Z" fill="url(#trophy-handle-r)"/>
      <path d="M9 18H15V21H9V18Z" fill="url(#trophy-base)"/>
      <path d="M7 21H17V22C17 22.55 16.55 23 16 23H8C7.45 23 7 22.55 7 22V21Z" fill="url(#trophy-stand)"/>
      <path d="M10 15H14V18H10V15Z" fill="url(#trophy-stem)"/>
      <circle cx="12" cy="8" r="2" fill="#FFFBEB" opacity="0.4"/>
      <defs>
        <linearGradient id="trophy-gradient" x1="5" y1="4" x2="19" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="0.5" stopColor="#F59E0B"/>
          <stop offset="1" stopColor="#D97706"/>
        </linearGradient>
        <linearGradient id="trophy-handle-l" x1="2" y1="4" x2="5" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="trophy-handle-r" x1="19" y1="4" x2="22" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="trophy-base" x1="9" y1="18" x2="15" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#92400E"/>
          <stop offset="1" stopColor="#78350F"/>
        </linearGradient>
        <linearGradient id="trophy-stand" x1="7" y1="21" x2="17" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#78350F"/>
          <stop offset="1" stopColor="#451A03"/>
        </linearGradient>
        <linearGradient id="trophy-stem" x1="10" y1="15" x2="14" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D97706"/>
          <stop offset="1" stopColor="#B45309"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🥇 Золотая медаль
export function GoldMedalIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L10 6H14L12 2Z" fill="#EF4444"/>
      <path d="M10 6L8 10H16L14 6H10Z" fill="#DC2626"/>
      <circle cx="12" cy="16" r="6" fill="url(#gold-medal-gradient)"/>
      <circle cx="12" cy="16" r="4.5" fill="url(#gold-medal-inner)" stroke="#B45309" strokeWidth="0.5"/>
      <text x="12" y="18" textAnchor="middle" fill="#78350F" fontSize="5" fontWeight="bold">1</text>
      <defs>
        <linearGradient id="gold-medal-gradient" x1="6" y1="10" x2="18" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A"/>
          <stop offset="0.5" stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="gold-medal-inner" x1="7.5" y1="11.5" x2="16.5" y2="20.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEF3C7"/>
          <stop offset="1" stopColor="#FCD34D"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🥈 Серебряная медаль
export function SilverMedalIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L10 6H14L12 2Z" fill="#3B82F6"/>
      <path d="M10 6L8 10H16L14 6H10Z" fill="#2563EB"/>
      <circle cx="12" cy="16" r="6" fill="url(#silver-medal-gradient)"/>
      <circle cx="12" cy="16" r="4.5" fill="url(#silver-medal-inner)" stroke="#6B7280" strokeWidth="0.5"/>
      <text x="12" y="18" textAnchor="middle" fill="#374151" fontSize="5" fontWeight="bold">2</text>
      <defs>
        <linearGradient id="silver-medal-gradient" x1="6" y1="10" x2="18" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F3F4F6"/>
          <stop offset="0.5" stopColor="#D1D5DB"/>
          <stop offset="1" stopColor="#9CA3AF"/>
        </linearGradient>
        <linearGradient id="silver-medal-inner" x1="7.5" y1="11.5" x2="16.5" y2="20.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF"/>
          <stop offset="1" stopColor="#E5E7EB"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🥉 Бронзовая медаль
export function BronzeMedalIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L10 6H14L12 2Z" fill="#22C55E"/>
      <path d="M10 6L8 10H16L14 6H10Z" fill="#16A34A"/>
      <circle cx="12" cy="16" r="6" fill="url(#bronze-medal-gradient)"/>
      <circle cx="12" cy="16" r="4.5" fill="url(#bronze-medal-inner)" stroke="#92400E" strokeWidth="0.5"/>
      <text x="12" y="18" textAnchor="middle" fill="#451A03" fontSize="5" fontWeight="bold">3</text>
      <defs>
        <linearGradient id="bronze-medal-gradient" x1="6" y1="10" x2="18" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD9B6"/>
          <stop offset="0.5" stopColor="#D97706"/>
          <stop offset="1" stopColor="#92400E"/>
        </linearGradient>
        <linearGradient id="bronze-medal-inner" x1="7.5" y1="11.5" x2="16.5" y2="20.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEEBC8"/>
          <stop offset="1" stopColor="#D97706"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🎮 Геймпад (игра)
export function GamepadIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path 
        d="M6 9C3.79 9 2 10.79 2 13V14C2 16.21 3.79 18 6 18C7.1 18 8.12 17.55 8.88 16.82L10.58 15H13.42L15.12 16.82C15.88 17.55 16.9 18 18 18C20.21 18 22 16.21 22 14V13C22 10.79 20.21 9 18 9H6Z" 
        fill="url(#gamepad-gradient)"
      />
      <circle cx="7" cy="13" r="1.5" fill="#FFFFFF"/>
      <circle cx="17" cy="12" r="1" fill="#EF4444"/>
      <circle cx="17" cy="14" r="1" fill="#3B82F6"/>
      <rect x="15.5" y="12.5" width="3" height="1" rx="0.5" fill="url(#gamepad-btn-h)"/>
      <rect x="16.5" y="11.5" width="1" height="3" rx="0.5" fill="url(#gamepad-btn-v)"/>
      <defs>
        <linearGradient id="gamepad-gradient" x1="2" y1="9" x2="22" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA"/>
          <stop offset="0.5" stopColor="#8B5CF6"/>
          <stop offset="1" stopColor="#7C3AED"/>
        </linearGradient>
        <linearGradient id="gamepad-btn-h" x1="15.5" y1="13" x2="18.5" y2="13" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F3F4F6"/>
          <stop offset="1" stopColor="#E5E7EB"/>
        </linearGradient>
        <linearGradient id="gamepad-btn-v" x1="17" y1="11.5" x2="17" y2="14.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F3F4F6"/>
          <stop offset="1" stopColor="#E5E7EB"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🔥 Огонь (горячее/стрик)
export function FireIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path 
        d="M12 23C16.4183 23 20 19.4183 20 15C20 11 17 8 15 6C15 9 13 11 12 11C11 11 9.5 9.5 9 7C7 9 4 12 4 15C4 19.4183 7.58172 23 12 23Z" 
        fill="url(#fire-gradient-outer)"
      />
      <path 
        d="M12 23C14.7614 23 17 20.3137 17 17C17 14.5 15.5 12.5 14 11C14 13 13 14 12 14C11 14 10 13 9.5 11.5C8.5 13 8 14.5 8 17C8 20.3137 9.23858 23 12 23Z" 
        fill="url(#fire-gradient-inner)"
      />
      <defs>
        <linearGradient id="fire-gradient-outer" x1="4" y1="6" x2="20" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="0.3" stopColor="#F97316"/>
          <stop offset="0.7" stopColor="#EF4444"/>
          <stop offset="1" stopColor="#DC2626"/>
        </linearGradient>
        <linearGradient id="fire-gradient-inner" x1="8" y1="11" x2="17" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEF3C7"/>
          <stop offset="0.5" stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🎯 Мишень (цель)
export function TargetIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#FEE2E2"/>
      <circle cx="12" cy="12" r="7" fill="#FECACA"/>
      <circle cx="12" cy="12" r="4" fill="#FCA5A5"/>
      <circle cx="12" cy="12" r="2" fill="url(#target-center)"/>
      <defs>
        <linearGradient id="target-center" x1="10" y1="10" x2="14" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EF4444"/>
          <stop offset="1" stopColor="#DC2626"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🎁 Подарок
export function GiftIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="10" width="18" height="11" rx="2" fill="url(#gift-box)"/>
      <rect x="3" y="8" width="18" height="4" rx="1" fill="url(#gift-lid)"/>
      <rect x="10.5" y="8" width="3" height="13" fill="url(#gift-ribbon-v)"/>
      <path d="M12 8C12 8 8 8 8 5C8 3 10 2 12 4C14 2 16 3 16 5C16 8 12 8 12 8Z" fill="url(#gift-bow)"/>
      <defs>
        <linearGradient id="gift-box" x1="3" y1="10" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F472B6"/>
          <stop offset="1" stopColor="#EC4899"/>
        </linearGradient>
        <linearGradient id="gift-lid" x1="3" y1="8" x2="21" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FB7185"/>
          <stop offset="1" stopColor="#F43F5E"/>
        </linearGradient>
        <linearGradient id="gift-ribbon-v" x1="12" y1="8" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047"/>
          <stop offset="1" stopColor="#EAB308"/>
        </linearGradient>
        <linearGradient id="gift-bow" x1="8" y1="2" x2="16" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047"/>
          <stop offset="1" stopColor="#FACC15"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🔄 Обновление/Сброс
export function RefreshIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path 
        d="M4 12C4 7.58172 7.58172 4 12 4C15.0736 4 17.7519 5.72621 19.1274 8.25H16" 
        stroke="url(#refresh-gradient)" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M20 12C20 16.4183 16.4183 20 12 20C8.92641 20 6.24813 18.2738 4.87259 15.75H8" 
        stroke="url(#refresh-gradient-2)" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="refresh-gradient" x1="4" y1="4" x2="19" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399"/>
          <stop offset="1" stopColor="#10B981"/>
        </linearGradient>
        <linearGradient id="refresh-gradient-2" x1="8" y1="12" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981"/>
          <stop offset="1" stopColor="#059669"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 💰 Деньги/Монета
export function CoinIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="url(#coin-gradient)"/>
      <circle cx="12" cy="12" r="7.5" fill="url(#coin-inner)" stroke="#B45309" strokeWidth="0.5"/>
      <text x="12" y="16" textAnchor="middle" fill="#78350F" fontSize="10" fontWeight="bold">₽</text>
      <defs>
        <linearGradient id="coin-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A"/>
          <stop offset="0.5" stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="coin-inner" x1="4.5" y1="4.5" x2="19.5" y2="19.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEF3C7"/>
          <stop offset="1" stopColor="#FCD34D"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// ✅ Галочка (верно)
export function CheckIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="url(#check-bg)"/>
      <path d="M7 12.5L10.5 16L17 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="check-bg" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399"/>
          <stop offset="1" stopColor="#10B981"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 📊 Статистика/График
export function ChartIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="14" width="4" height="7" rx="1" fill="url(#chart-bar-1)"/>
      <rect x="10" y="9" width="4" height="12" rx="1" fill="url(#chart-bar-2)"/>
      <rect x="17" y="4" width="4" height="17" rx="1" fill="url(#chart-bar-3)"/>
      <defs>
        <linearGradient id="chart-bar-1" x1="5" y1="14" x2="5" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A5FA"/>
          <stop offset="1" stopColor="#3B82F6"/>
        </linearGradient>
        <linearGradient id="chart-bar-2" x1="12" y1="9" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA"/>
          <stop offset="1" stopColor="#8B5CF6"/>
        </linearGradient>
        <linearGradient id="chart-bar-3" x1="19" y1="4" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F472B6"/>
          <stop offset="1" stopColor="#EC4899"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 📈 Рост/Прогресс
export function TrendUpIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path 
        d="M3 17L9 11L13 15L21 7" 
        stroke="url(#trend-line)" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M15 7H21V13" 
        stroke="url(#trend-arrow)" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="trend-line" x1="3" y1="17" x2="21" y2="7" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399"/>
          <stop offset="1" stopColor="#10B981"/>
        </linearGradient>
        <linearGradient id="trend-arrow" x1="15" y1="7" x2="21" y2="13" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399"/>
          <stop offset="1" stopColor="#059669"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 👥 Люди/Участники
export function UsersIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="4" fill="url(#users-head-1)"/>
      <path d="M2 21V19C2 16.2386 4.23858 14 7 14H11C13.7614 14 16 16.2386 16 19V21" fill="url(#users-body-1)"/>
      <circle cx="17" cy="7" r="3" fill="url(#users-head-2)"/>
      <path d="M17 14C19.2091 14 21 15.7909 21 18V21H16V19C16 16.9 15.2 15 13.9 13.6C14.5 13.2 15.3 13 17 13V14Z" fill="url(#users-body-2)"/>
      <defs>
        <linearGradient id="users-head-1" x1="5" y1="3" x2="13" y2="11" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="users-body-1" x1="2" y1="14" x2="16" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A5FA"/>
          <stop offset="1" stopColor="#3B82F6"/>
        </linearGradient>
        <linearGradient id="users-head-2" x1="14" y1="4" x2="20" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F9A8D4"/>
          <stop offset="1" stopColor="#F472B6"/>
        </linearGradient>
        <linearGradient id="users-body-2" x1="13" y1="13" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C4B5FD"/>
          <stop offset="1" stopColor="#A78BFA"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🔔 Колокольчик/Уведомление
export function BellIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path 
        d="M12 3C8.68629 3 6 5.68629 6 9V14L4 17H20L18 14V9C18 5.68629 15.3137 3 12 3Z" 
        fill="url(#bell-gradient)"
      />
      <path d="M10 20C10 21.1046 10.8954 22 12 22C13.1046 22 14 21.1046 14 20H10Z" fill="url(#bell-clapper)"/>
      <circle cx="12" cy="3" r="1.5" fill="url(#bell-top)"/>
      <defs>
        <linearGradient id="bell-gradient" x1="4" y1="3" x2="20" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="bell-clapper" x1="10" y1="20" x2="14" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D97706"/>
          <stop offset="1" stopColor="#B45309"/>
        </linearGradient>
        <linearGradient id="bell-top" x1="10.5" y1="1.5" x2="13.5" y2="4.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A"/>
          <stop offset="1" stopColor="#FCD34D"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// ⏳ Песочные часы (ожидание)
export function HourglassIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 2H18V6L14 12L18 18V22H6V18L10 12L6 6V2Z" fill="url(#hourglass-frame)"/>
      <path d="M8 4H16V5.5L13 10H11L8 5.5V4Z" fill="url(#hourglass-sand-top)"/>
      <path d="M11 14H13L16 18.5V20H8V18.5L11 14Z" fill="url(#hourglass-sand-bottom)"/>
      <defs>
        <linearGradient id="hourglass-frame" x1="6" y1="2" x2="18" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA"/>
          <stop offset="1" stopColor="#7C3AED"/>
        </linearGradient>
        <linearGradient id="hourglass-sand-top" x1="8" y1="4" x2="16" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="hourglass-sand-bottom" x1="8" y1="14" x2="16" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 👤 Пользователь
export function UserIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="5" fill="url(#user-head)"/>
      <path d="M4 21V19C4 15.6863 6.68629 13 10 13H14C17.3137 13 20 15.6863 20 19V21" fill="url(#user-body)"/>
      <defs>
        <linearGradient id="user-head" x1="7" y1="3" x2="17" y2="13" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="user-body" x1="4" y1="13" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A5FA"/>
          <stop offset="1" stopColor="#3B82F6"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// ✨ Звёздочки/Магия
export function SparklesIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="url(#sparkle-main)"/>
      <path d="M19 14L19.75 16.25L22 17L19.75 17.75L19 20L18.25 17.75L16 17L18.25 16.25L19 14Z" fill="url(#sparkle-small-1)"/>
      <path d="M5 14L5.5 15.5L7 16L5.5 16.5L5 18L4.5 16.5L3 16L4.5 15.5L5 14Z" fill="url(#sparkle-small-2)"/>
      <defs>
        <linearGradient id="sparkle-main" x1="4" y1="2" x2="20" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047"/>
          <stop offset="0.5" stopColor="#FBBF24"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="sparkle-small-1" x1="16" y1="14" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047"/>
          <stop offset="1" stopColor="#FBBF24"/>
        </linearGradient>
        <linearGradient id="sparkle-small-2" x1="3" y1="14" x2="7" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047"/>
          <stop offset="1" stopColor="#FBBF24"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🤝 Рукопожатие (ничья)
export function HandshakeIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 6L3 11L5 13L10 8" fill="url(#hand-left)"/>
      <path d="M16 6L21 11L19 13L14 8" fill="url(#hand-right)"/>
      <path d="M5 13L7 15L12 10L17 15L19 13" fill="url(#handshake-middle)"/>
      <path d="M7 15L9 17L12 14L15 17L17 15" fill="url(#handshake-lower)"/>
      <defs>
        <linearGradient id="hand-left" x1="3" y1="6" x2="10" y2="13" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD9B6"/>
          <stop offset="1" stopColor="#F5C08B"/>
        </linearGradient>
        <linearGradient id="hand-right" x1="14" y1="6" x2="21" y2="13" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD9B6"/>
          <stop offset="1" stopColor="#F5C08B"/>
        </linearGradient>
        <linearGradient id="handshake-middle" x1="5" y1="10" x2="19" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD9B6"/>
          <stop offset="1" stopColor="#D4A574"/>
        </linearGradient>
        <linearGradient id="handshake-lower" x1="7" y1="14" x2="17" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E5C4A1"/>
          <stop offset="1" stopColor="#C4A075"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 💀 Череп (поражение)
export function SkullIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C7.58172 2 4 5.58172 4 10V14C4 16.2091 5.79086 18 8 18V21C8 21.5523 8.44772 22 9 22H15C15.5523 22 16 21.5523 16 21V18C18.2091 18 20 16.2091 20 14V10C20 5.58172 16.4183 2 12 2Z" fill="url(#skull-gradient)"/>
      <ellipse cx="8.5" cy="11" rx="2" ry="2.5" fill="#1F2937"/>
      <ellipse cx="15.5" cy="11" rx="2" ry="2.5" fill="#1F2937"/>
      <path d="M10 16V18" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 16V18" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 16V18" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round"/>
      <defs>
        <linearGradient id="skull-gradient" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F3F4F6"/>
          <stop offset="0.5" stopColor="#E5E7EB"/>
          <stop offset="1" stopColor="#D1D5DB"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🔍 Поиск/Лупа
export function SearchIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" fill="url(#search-glass)" stroke="url(#search-ring)" strokeWidth="2"/>
      <path d="M16 16L21 21" stroke="url(#search-handle)" strokeWidth="3" strokeLinecap="round"/>
      <defs>
        <linearGradient id="search-glass" x1="4" y1="4" x2="18" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DBEAFE"/>
          <stop offset="1" stopColor="#BFDBFE"/>
        </linearGradient>
        <linearGradient id="search-ring" x1="4" y1="4" x2="18" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6"/>
          <stop offset="1" stopColor="#2563EB"/>
        </linearGradient>
        <linearGradient id="search-handle" x1="16" y1="16" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6"/>
          <stop offset="1" stopColor="#1D4ED8"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// ⚠️ Предупреждение
export function WarningIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 20H22L12 2Z" fill="url(#warning-bg)"/>
      <path d="M12 8V14" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="12" cy="17" r="1.25" fill="#78350F"/>
      <defs>
        <linearGradient id="warning-bg" x1="2" y1="2" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047"/>
          <stop offset="1" stopColor="#FBBF24"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// ⚔️ Скрещенные мечи (дуэли)
export function SwordsIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4.5 3L15 13.5L13.5 15L3 4.5L4.5 3Z" fill="url(#sword-1-blade)"/>
      <path d="M3 4.5L4.5 3L6 4.5L4.5 6L3 4.5Z" fill="url(#sword-1-guard)"/>
      <path d="M2 6L4.5 6L3 7.5L2 6Z" fill="url(#sword-1-handle)"/>
      <path d="M19.5 3L9 13.5L10.5 15L21 4.5L19.5 3Z" fill="url(#sword-2-blade)"/>
      <path d="M21 4.5L19.5 3L18 4.5L19.5 6L21 4.5Z" fill="url(#sword-2-guard)"/>
      <path d="M22 6L19.5 6L21 7.5L22 6Z" fill="url(#sword-2-handle)"/>
      <circle cx="12" cy="14" r="3" fill="url(#sword-clash)"/>
      <defs>
        <linearGradient id="sword-1-blade" x1="3" y1="3" x2="15" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E5E7EB"/>
          <stop offset="0.5" stopColor="#D1D5DB"/>
          <stop offset="1" stopColor="#9CA3AF"/>
        </linearGradient>
        <linearGradient id="sword-1-guard" x1="3" y1="3" x2="6" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="sword-1-handle" x1="2" y1="6" x2="4.5" y2="7.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#92400E"/>
          <stop offset="1" stopColor="#78350F"/>
        </linearGradient>
        <linearGradient id="sword-2-blade" x1="9" y1="3" x2="21" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E5E7EB"/>
          <stop offset="0.5" stopColor="#D1D5DB"/>
          <stop offset="1" stopColor="#9CA3AF"/>
        </linearGradient>
        <linearGradient id="sword-2-guard" x1="18" y1="3" x2="21" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="sword-2-handle" x1="19.5" y1="6" x2="22" y2="7.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#92400E"/>
          <stop offset="1" stopColor="#78350F"/>
        </linearGradient>
        <linearGradient id="sword-clash" x1="9" y1="11" x2="15" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE047"/>
          <stop offset="1" stopColor="#FBBF24"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🗺️ Карта (панорамы)
export function MapIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 6L9 3V18L3 21V6Z" fill="url(#map-left)"/>
      <path d="M9 3L15 6V21L9 18V3Z" fill="url(#map-center)"/>
      <path d="M15 6L21 3V18L15 21V6Z" fill="url(#map-right)"/>
      <circle cx="6" cy="10" r="1" fill="#EF4444"/>
      <circle cx="12" cy="12" r="1.5" fill="#EF4444"/>
      <circle cx="18" cy="9" r="1" fill="#EF4444"/>
      <defs>
        <linearGradient id="map-left" x1="3" y1="3" x2="9" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A7F3D0"/>
          <stop offset="1" stopColor="#6EE7B7"/>
        </linearGradient>
        <linearGradient id="map-center" x1="9" y1="3" x2="15" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#93C5FD"/>
          <stop offset="1" stopColor="#60A5FA"/>
        </linearGradient>
        <linearGradient id="map-right" x1="15" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A"/>
          <stop offset="1" stopColor="#FCD34D"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 📅 Календарь
export function CalendarIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="3" fill="url(#calendar-body)"/>
      <rect x="3" y="4" width="18" height="5" rx="3" fill="url(#calendar-header)"/>
      <rect x="7" y="2" width="2" height="4" rx="1" fill="url(#calendar-hook)"/>
      <rect x="15" y="2" width="2" height="4" rx="1" fill="url(#calendar-hook)"/>
      <rect x="6" y="12" width="3" height="3" rx="0.5" fill="#6B7280"/>
      <rect x="10.5" y="12" width="3" height="3" rx="0.5" fill="url(#calendar-day-active)"/>
      <rect x="15" y="12" width="3" height="3" rx="0.5" fill="#6B7280"/>
      <rect x="6" y="17" width="3" height="2" rx="0.5" fill="#9CA3AF"/>
      <rect x="10.5" y="17" width="3" height="2" rx="0.5" fill="#9CA3AF"/>
      <rect x="15" y="17" width="3" height="2" rx="0.5" fill="#9CA3AF"/>
      <defs>
        <linearGradient id="calendar-body" x1="3" y1="4" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F3F4F6"/>
          <stop offset="1" stopColor="#E5E7EB"/>
        </linearGradient>
        <linearGradient id="calendar-header" x1="3" y1="4" x2="21" y2="9" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EF4444"/>
          <stop offset="1" stopColor="#DC2626"/>
        </linearGradient>
        <linearGradient id="calendar-hook" x1="8" y1="2" x2="8" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6B7280"/>
          <stop offset="1" stopColor="#4B5563"/>
        </linearGradient>
        <linearGradient id="calendar-day-active" x1="10.5" y1="12" x2="13.5" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6"/>
          <stop offset="1" stopColor="#2563EB"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 📋 Документ/Правила
export function ClipboardIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="14" height="18" rx="2" fill="url(#clipboard-body)"/>
      <rect x="8" y="1" width="8" height="4" rx="1" fill="url(#clipboard-clip)"/>
      <rect x="8" y="9" width="8" height="1.5" rx="0.5" fill="#6B7280"/>
      <rect x="8" y="12" width="6" height="1.5" rx="0.5" fill="#9CA3AF"/>
      <rect x="8" y="15" width="7" height="1.5" rx="0.5" fill="#9CA3AF"/>
      <defs>
        <linearGradient id="clipboard-body" x1="5" y1="3" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A"/>
          <stop offset="1" stopColor="#FCD34D"/>
        </linearGradient>
        <linearGradient id="clipboard-clip" x1="8" y1="1" x2="16" y2="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA"/>
          <stop offset="1" stopColor="#8B5CF6"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🛤️ Путь/Дорога
export function PathIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 20L9 4H15L19 20H5Z" fill="url(#path-road)"/>
      <rect x="6" y="8" width="3" height="1" fill="#FDE68A"/>
      <rect x="8" y="12" width="3" height="1" fill="#FDE68A"/>
      <rect x="10" y="16" width="3" height="1" fill="#FDE68A"/>
      <circle cx="12" cy="2" r="2" fill="url(#path-start)"/>
      <circle cx="12" cy="22" r="2" fill="url(#path-end)"/>
      <defs>
        <linearGradient id="path-road" x1="5" y1="4" x2="19" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6B7280"/>
          <stop offset="1" stopColor="#4B5563"/>
        </linearGradient>
        <linearGradient id="path-start" x1="10" y1="0" x2="14" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399"/>
          <stop offset="1" stopColor="#10B981"/>
        </linearGradient>
        <linearGradient id="path-end" x1="10" y1="20" x2="14" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EF4444"/>
          <stop offset="1" stopColor="#DC2626"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🏅 Медаль
export function MedalIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 2H16L14 8H10L8 2Z" fill="url(#medal-ribbon)"/>
      <circle cx="12" cy="14" r="7" fill="url(#medal-circle)"/>
      <circle cx="12" cy="14" r="5" fill="url(#medal-inner)" stroke="#B45309" strokeWidth="0.5"/>
      <path d="M12 10L13 12.5L15.5 12.5L13.75 14L14.5 16.5L12 15L9.5 16.5L10.25 14L8.5 12.5L11 12.5L12 10Z" fill="#FFFBEB"/>
      <defs>
        <linearGradient id="medal-ribbon" x1="8" y1="2" x2="16" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6"/>
          <stop offset="1" stopColor="#2563EB"/>
        </linearGradient>
        <linearGradient id="medal-circle" x1="5" y1="7" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A"/>
          <stop offset="0.5" stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="medal-inner" x1="7" y1="9" x2="17" y2="19" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEF3C7"/>
          <stop offset="1" stopColor="#FCD34D"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// 🎁 Сундук с призами (Treasure Chest)
export function TreasureChestIcon({ className, size = 24 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Основа сундука */}
      <path d="M3 10V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V10H3Z" fill="url(#chest-body)"/>
      {/* Крышка */}
      <path d="M3 10C3 7.79 4.79 6 7 6H17C19.21 6 21 7.79 21 10H3Z" fill="url(#chest-lid)"/>
      {/* Полоски */}
      <rect x="3" y="9" width="18" height="2" fill="url(#chest-band)"/>
      <rect x="10" y="6" width="4" height="6" rx="1" fill="url(#chest-lock-plate)"/>
      {/* Замок */}
      <circle cx="12" cy="11" r="1.5" fill="url(#chest-lock)"/>
      <rect x="11.25" y="11" width="1.5" height="2" fill="#78350F"/>
      {/* Блики */}
      <path d="M5 8C5 8 6 7 8 7" stroke="#FEF3C7" strokeWidth="0.5" strokeLinecap="round" opacity="0.6"/>
      {/* Монеты внутри (видны сверху) */}
      <circle cx="7" cy="8" r="1" fill="#FCD34D" opacity="0.8"/>
      <circle cx="9" cy="7.5" r="0.8" fill="#FDE68A" opacity="0.7"/>
      <circle cx="15" cy="7.8" r="0.9" fill="#FCD34D" opacity="0.8"/>
      <circle cx="17" cy="8" r="0.7" fill="#FDE68A" opacity="0.6"/>
      <defs>
        <linearGradient id="chest-body" x1="3" y1="10" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#92400E"/>
          <stop offset="0.5" stopColor="#78350F"/>
          <stop offset="1" stopColor="#451A03"/>
        </linearGradient>
        <linearGradient id="chest-lid" x1="3" y1="6" x2="21" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B45309"/>
          <stop offset="0.5" stopColor="#92400E"/>
          <stop offset="1" stopColor="#78350F"/>
        </linearGradient>
        <linearGradient id="chest-band" x1="3" y1="10" x2="21" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D"/>
          <stop offset="0.5" stopColor="#F59E0B"/>
          <stop offset="1" stopColor="#D97706"/>
        </linearGradient>
        <linearGradient id="chest-lock-plate" x1="10" y1="6" x2="14" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <linearGradient id="chest-lock" x1="10.5" y1="9.5" x2="13.5" y2="12.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#92400E"/>
          <stop offset="1" stopColor="#78350F"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

