"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { HERO_HEIGHT } from "./HeroShell";

/**
 * HeroRich — Full decorative hero block with effects
 * 
 * Этот компонент содержит все тяжёлые эффекты:
 * - motion/framer-motion animations
 * - blur/backdrop-filter (с учётом Android и perf-mode)
 * - Remote images (сундук)
 * - Animated glow effects
 * 
 * Накладывается поверх HeroShell после defer.
 * При perf-mode анимации приостанавливаются.
 */

type LeaderboardPosition = {
  place: number;
  score: number;
  totalPlayers?: number;
  topScore?: number;
};

type HeroRichProps = {
  weeklyTimeLeft: string;
  myPosition: LeaderboardPosition | null;
  isAndroid: boolean;
  isPerfMode: boolean;
  onPlayClick?: () => void;
  className?: string;
};

const spring = { type: "spring", stiffness: 400, damping: 30 };

export function HeroRich({ 
  weeklyTimeLeft, 
  myPosition, 
  isAndroid, 
  isPerfMode,
  onPlayClick,
  className = "" 
}: HeroRichProps) {
  // Disable animations during perf mode (scroll)
  const animate = !isPerfMode;
  
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`absolute inset-0 overflow-hidden rounded-[22px] ${className}`}
      style={{ height: HERO_HEIGHT }}
    >
      {/* Outer glow - always visible */}
      <div 
        className={`absolute -inset-4 rounded-[32px] fx-glow ${isAndroid ? '' : 'bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-amber-500/20 blur-2xl'}`}
        style={isAndroid ? {
          background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.15) 0%, rgba(217,70,239,0.1) 40%, transparent 70%)'
        } : undefined}
      />
      
      {/* Animated border */}
      <div className="absolute -inset-[2px] rounded-[24px] overflow-hidden">
        <motion.div
          animate={animate ? { rotate: 360 } : {}}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,#8b5cf6,#d946ef,#f59e0b,#06b6d4,#8b5cf6)]"
        />
      </div>
      
      {/* Main container */}
      <div className="absolute inset-0 rounded-[22px] bg-gradient-to-b from-[#0f0a1a] via-[#0a0a12] to-[#0a0812]">
        {/* Content — COMPACT */}
        <div className="relative px-4 py-3 h-full">
          
          {/* ═══ COUNTDOWN TIMER — Compact ═══ */}
          <div className="mb-3">
            {/* Timer label with pulsing dot */}
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <motion.div
                animate={animate ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50"
              />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-400">LIVE</span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">• До финиша</span>
            </div>
            
            {/* Big timer display — smaller */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative flex justify-center"
            >
              {/* Glow behind timer */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className={`w-40 h-12 bg-gradient-to-r from-violet-500/30 via-fuchsia-500/30 to-amber-500/30 rounded-full ${isAndroid || isPerfMode ? 'shadow-[0_0_30px_15px_rgba(139,92,246,0.3)]' : 'blur-xl'}`}
                />
              </div>
              
              <div className="relative flex items-baseline gap-1">
                <motion.span
                  animate={animate ? { 
                    textShadow: [
                      "0 0 15px rgba(139,92,246,0.5)",
                      "0 0 30px rgba(217,70,239,0.5)",
                      "0 0 15px rgba(139,92,246,0.5)",
                    ]
                  } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-[38px] font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-200 to-amber-200"
                  style={{ 
                    fontVariantNumeric: "tabular-nums", 
                    letterSpacing: "-0.02em",
                    minWidth: "7ch"
                  }}
                >
                  {weeklyTimeLeft || "—"}
                </motion.span>
              </div>
            </motion.div>
            
            {/* Sub-label */}
            <p className="text-center text-[9px] text-white/30 mt-1">
              Сброс в воскресенье 00:00 МСК
            </p>
          </div>

          {/* ═══ PRIZE POOL — Compact Card ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative mb-3 rounded-xl overflow-hidden"
          >
            {/* Card background */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-violet-500/10" />
            <div className={`absolute inset-0 ${isAndroid || isPerfMode ? 'bg-black/40' : 'backdrop-blur-sm'}`} />
            
            {/* Shimmer effect */}
            {!isPerfMode && (
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent skew-x-12"
              />
            )}
            
            <div className="relative p-3 border border-white/[0.08] rounded-xl">
              <div className="flex items-center justify-between">
                {/* Left: Prize info */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-[8px] font-bold uppercase tracking-wide text-emerald-400">
                      Призовой фонд
                    </span>
                  </div>
                  <div className="flex items-baseline">
                    <span 
                      className="text-[32px] font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200" 
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      1 750
                    </span>
                    <span className="ml-1 text-[16px] font-bold text-amber-400/60">₽</span>
                  </div>
                </div>
                
                {/* Right: Trophy with animation — smaller */}
                <motion.div
                  animate={animate ? { 
                    rotate: [0, 5, -5, 0],
                    y: [0, -2, 0],
                  } : {}}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="relative"
                >
                  {/* Glow behind chest - always visible */}
                  <div 
                    className={`absolute inset-0 rounded-full scale-150 fx-glow ${isAndroid ? '' : 'bg-amber-400/40 blur-xl'}`}
                    style={isAndroid ? {
                      background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, rgba(251,191,36,0.2) 40%, transparent 70%)'
                    } : undefined}
                  />
                  <Image 
                    src="/icons/17.webp" 
                    alt="" 
                    width={64}
                    height={64}
                    className={`relative h-16 w-16 object-contain ${isAndroid ? 'drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]' : 'drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]'}`} 
                  />
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* ═══ PRIZE TIERS — Compact Cards ═══ */}
          <div className="mb-3 space-y-1.5">
            {[
              { place: 1, amount: "1 000", label: "Золото", gradient: "from-amber-500/25 via-yellow-500/15 to-orange-500/20", border: "border-amber-500/40", glow: "shadow-amber-500/20", textColor: "text-amber-200", badge: "bg-gradient-to-br from-amber-400 to-orange-500" },
              { place: 2, amount: "500", label: "Серебро", gradient: "from-slate-400/20 via-slate-300/10 to-slate-500/15", border: "border-slate-400/30", glow: "shadow-slate-400/15", textColor: "text-slate-200", badge: "bg-gradient-to-br from-slate-300 to-slate-500" },
              { place: 3, amount: "250", label: "Бронза", gradient: "from-orange-600/20 via-orange-500/10 to-amber-600/15", border: "border-orange-500/30", glow: "shadow-orange-500/15", textColor: "text-orange-200", badge: "bg-gradient-to-br from-orange-500 to-amber-600" },
            ].map((tier, i) => (
              <motion.div
                key={tier.place}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08, ...spring }}
                whileTap={{ scale: 0.98 }}
                className={`relative flex items-center gap-3 p-2.5 rounded-lg bg-gradient-to-r ${tier.gradient} border ${tier.border}`}
              >
                {/* Place badge — smaller */}
                <div className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${tier.badge} shadow-md`}>
                  {tier.place === 1 ? (
                    <>
                      {!isPerfMode && (
                        <motion.div
                          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute inset-0 rounded-lg bg-amber-400"
                        />
                      )}
                      <span className="text-2xl">🥇</span>
                    </>
                  ) : (
                    <span className="text-xl">{tier.place === 2 ? '🥈' : '🥉'}</span>
                  )}
                </div>
                
                {/* Label */}
                <div className="flex-1">
                  <p className={`text-[13px] font-bold ${tier.textColor}`}>{tier.label}</p>
                  <p className="text-[9px] text-white/40">{tier.place} место</p>
                </div>
                
                {/* Amount */}
                <div className="text-right">
                  <span className="text-[16px] font-black text-white" style={{ fontVariantNumeric: "tabular-nums" }}>{tier.amount}</span>
                  <span className="text-[10px] font-medium text-white/40 ml-0.5">₽</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ═══ YOUR POSITION — Compact ═══ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className={`relative mb-3 p-3 rounded-xl overflow-hidden ${
              myPosition && myPosition.place > 0 && myPosition.place <= 3
                ? "bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-cyan-500/20 border border-emerald-500/30"
                : "bg-gradient-to-r from-violet-500/15 via-violet-500/10 to-indigo-500/15 border border-violet-500/20"
            }`}
          >
            {/* Sparkle effect for top-3 */}
            {myPosition && myPosition.place > 0 && myPosition.place <= 3 && !isPerfMode && (
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent"
              />
            )}
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Position circle — smaller */}
                <motion.div
                  animate={myPosition && myPosition.place > 0 && myPosition.place <= 3 && animate ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-black text-[16px] ${
                    !myPosition || myPosition.place === 0
                      ? "bg-white/10 text-white/30 border-2 border-dashed border-white/20"
                      : myPosition.place === 1
                        ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/40"
                        : myPosition.place === 2
                          ? "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900 shadow-lg shadow-slate-400/30"
                          : myPosition.place === 3
                            ? "bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/40"
                            : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30"
                  }`}
                >
                  {!myPosition || myPosition.place === 0 ? "?" : myPosition.place}
                </motion.div>
                
                <div>
                  <p className="text-[10px] font-medium text-white/50 uppercase tracking-wide">Твоя позиция</p>
                  <p className="text-[15px] font-bold text-white">
                    {myPosition?.score ? `${myPosition.score.toLocaleString()} очков` : "Начни играть!"}
                  </p>
                </div>
              </div>
              
              {/* Status badge — smaller */}
              {myPosition && myPosition.place > 0 && (
                <div className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                  myPosition.place <= 3
                    ? "bg-emerald-500/30 text-emerald-300"
                    : "bg-violet-500/30 text-violet-300"
                }`}>
                  {myPosition.place <= 3 ? "🏆 В призах!" : `До топ-3: ${myPosition.place - 3}`}
                </div>
              )}
            </div>
          </motion.div>

          {/* ═══ CTA BUTTON — Compact ═══ */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onPlayClick}
            className="relative w-full p-2.5 rounded-lg bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 text-center overflow-hidden"
          >
            {/* Shimmer */}
            {!isPerfMode && (
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
              />
            )}
            <span className="relative text-[13px] font-bold text-white">Играть и выигрывать</span>
          </motion.button>
        </div>
      </div>
    </motion.section>
  );
}

