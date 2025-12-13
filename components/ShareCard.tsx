"use client";

import { forwardRef } from "react";

type ShareCardProps = {
  quizTitle: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  maxStreak: number;
  starCount: number;
  playerName?: string;
};

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ quizTitle, score, correctCount, totalQuestions, maxStreak, starCount, playerName }, ref) => {
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    
    return (
      <div
        ref={ref}
        className="w-[400px] h-[560px] relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0f0f1a 0%, #1a1025 50%, #0a0a0f 100%)",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Background effects */}
        <div 
          className="absolute -left-20 -top-20 w-60 h-60 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" }}
        />
        <div 
          className="absolute -right-20 -bottom-20 w-60 h-60 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #ec4899 0%, transparent 70%)" }}
        />
        <div 
          className="absolute left-1/2 top-1/3 w-40 h-40 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }}
        />
        
        {/* Decorative grid */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Content */}
        <div className="relative h-full flex flex-col p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-4">
              <span className="text-lg">🔍</span>
              <span className="text-white/80 font-semibold text-sm">{quizTitle}</span>
            </div>
            
            {playerName && (
              <p className="text-white/40 text-sm">Результат игрока {playerName}</p>
            )}
          </div>

          {/* Stars */}
          <div className="flex justify-center gap-3 mb-8">
            {[1, 2, 3, 4, 5].map((star) => (
              <div
                key={star}
                className="relative"
                style={{
                  filter: star <= starCount ? "drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))" : "none",
                }}
              >
                <span 
                  className="text-4xl"
                  style={{ 
                    opacity: star <= starCount ? 1 : 0.2,
                    filter: star <= starCount ? "none" : "grayscale(1)",
                  }}
                >
                  ⭐
                </span>
              </div>
            ))}
          </div>

          {/* Score */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div 
              className="relative rounded-3xl p-8 mb-6"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(236,72,153,0.2) 100%)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <p className="text-white/40 text-sm uppercase tracking-widest mb-2 text-center">Результат</p>
              <p 
                className="text-6xl font-black text-center"
                style={{
                  background: "linear-gradient(135deg, #fff 0%, #c4b5fd 50%, #f9a8d4 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  textShadow: "0 0 40px rgba(139,92,246,0.5)",
                }}
              >
                {score.toLocaleString()}
              </p>
              <p className="text-white/40 text-sm text-center mt-1">очков</p>
            </div>

            {/* Stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{correctCount}/{totalQuestions}</p>
                <p className="text-white/40 text-xs">верных</p>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">{accuracy}%</p>
                <p className="text-white/40 text-xs">точность</p>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-400">🔥 {maxStreak}</p>
                <p className="text-white/40 text-xs">серия</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-6 border-t border-white/10">
            <p className="text-white/60 text-sm mb-2">💀 Попробуй побить мой рекорд!</p>
            <div className="inline-flex items-center gap-2 bg-violet-500/20 rounded-full px-4 py-2">
              <span className="text-violet-300 text-sm font-medium">@truecrimetg_bot</span>
            </div>
          </div>
        </div>

        {/* Corner decorations */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-violet-500/30 rounded-tl-lg" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-violet-500/30 rounded-tr-lg" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-pink-500/30 rounded-bl-lg" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-pink-500/30 rounded-br-lg" />
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";

