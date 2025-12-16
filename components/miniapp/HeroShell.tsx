"use client";

/**
 * HeroShell — Lightweight static hero block for fast LCP
 * 
 * ВАЖНО: Этот компонент НЕ ДОЛЖЕН содержать:
 * - blur/backdrop-filter
 * - motion/framer-motion animations
 * - remote images (img src with http)
 * - heavy CSS filters
 * 
 * Это статичный "shell" который рендерится мгновенно и становится LCP-кандидатом.
 * После загрузки данных поверх накладывается HeroRich.
 */

type HeroShellProps = {
  className?: string;
};

// Высота hero-блока — фиксированная для предотвращения CLS
export const HERO_HEIGHT = 420; // px — компактная версия

export function HeroShell({ className = "" }: HeroShellProps) {
  return (
    <section 
      className={`relative overflow-hidden rounded-[22px] ${className}`}
      style={{ height: HERO_HEIGHT }}
    >
      {/* Static gradient border — no animation */}
      <div className="absolute -inset-[2px] rounded-[24px] bg-gradient-to-br from-violet-500/50 via-fuchsia-500/40 to-amber-500/50" />
      
      {/* Main container — solid background, no blur */}
      <div className="absolute inset-0 rounded-[22px] bg-gradient-to-b from-[#0f0a1a] via-[#0a0a12] to-[#0a0812]">
        {/* Content — COMPACT */}
        <div className="relative px-4 py-3 h-full">
          
          {/* ═══ COUNTDOWN TIMER — Static Shell Compact ═══ */}
          <div className="mb-3">
            {/* Timer label — static */}
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-400">LIVE</span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">• До финиша</span>
            </div>
            
            {/* Big timer display — skeleton placeholder */}
            <div className="relative flex justify-center">
              {/* Static glow — radial gradient, no blur */}
              <div 
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.2) 0%, rgba(217,70,239,0.15) 30%, transparent 60%)'
                }}
              />
              
              <div className="relative flex items-baseline gap-1">
                {/* Placeholder timer — uses min-width to prevent CLS */}
                <span 
                  className="text-[38px] font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-200 to-amber-200"
                  style={{ 
                    fontVariantNumeric: "tabular-nums", 
                    letterSpacing: "-0.02em",
                    minWidth: "7ch"
                  }}
                >
                  —
                </span>
              </div>
            </div>
            
            {/* Sub-label */}
            <p className="text-center text-[9px] text-white/30 mt-1">
              Сброс в воскресенье 00:00 МСК
            </p>
          </div>

          {/* ═══ PRIZE POOL — Static Card Compact ═══ */}
          <div className="relative mb-3 rounded-xl overflow-hidden">
            {/* Card background — solid, no blur */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-violet-500/10" />
            <div className="absolute inset-0 bg-black/40" />
            
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
                
                {/* Right: Trophy placeholder — static emoji, no image */}
                <div className="relative">
                  {/* Static glow */}
                  <div 
                    className="absolute inset-0 rounded-full scale-150"
                    style={{
                      background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, rgba(251,191,36,0.15) 40%, transparent 70%)'
                    }}
                  />
                  {/* Emoji placeholder — will be replaced by HeroRich */}
                  <span className="relative text-6xl">🏆</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ PRIZE TIERS — Static Cards Compact ═══ */}
          <div className="mb-3 space-y-1.5">
            {[
              { place: 1, amount: "1 000", label: "Золото", gradient: "from-amber-500/25 via-yellow-500/15 to-orange-500/20", border: "border-amber-500/40", textColor: "text-amber-200", emoji: "🥇" },
              { place: 2, amount: "500", label: "Серебро", gradient: "from-slate-400/20 via-slate-300/10 to-slate-500/15", border: "border-slate-400/30", textColor: "text-slate-200", emoji: "🥈" },
              { place: 3, amount: "250", label: "Бронза", gradient: "from-orange-600/20 via-orange-500/10 to-amber-600/15", border: "border-orange-500/30", textColor: "text-orange-200", emoji: "🥉" },
            ].map((tier) => (
              <div
                key={tier.place}
                className={`relative flex items-center gap-3 p-2.5 rounded-lg bg-gradient-to-r ${tier.gradient} border ${tier.border}`}
              >
                {/* Place badge — smaller */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <span className="text-xl">{tier.emoji}</span>
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
              </div>
            ))}
          </div>

          {/* ═══ YOUR POSITION — Compact ═══ */}
          <div className="relative mb-3 p-3 rounded-xl overflow-hidden bg-gradient-to-r from-violet-500/15 via-violet-500/10 to-indigo-500/15 border border-violet-500/20">
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Position circle — placeholder */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/30 border-2 border-dashed border-white/20 font-black text-[16px]">
                  ?
                </div>
                
                <div>
                  <p className="text-[10px] font-medium text-white/50 uppercase tracking-wide">Твоя позиция</p>
                  <p className="text-[15px] font-bold text-white">Загрузка...</p>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ CTA BUTTON — Compact ═══ */}
          <div className="relative p-2.5 rounded-lg bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 text-center">
            <span className="text-[13px] font-bold text-white">Играть и выигрывать</span>
          </div>
        </div>
      </div>
    </section>
  );
}

