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
        style={{
          width: 400,
          height: 560,
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #0f0f1a 0%, #1a1025 50%, #0a0a0f 100%)",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Background effects */}
        <div 
          style={{
            position: "absolute",
            left: -80,
            top: -80,
            width: 240,
            height: 240,
            borderRadius: "50%",
            opacity: 0.3,
            background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
          }}
        />
        <div 
          style={{
            position: "absolute",
            right: -80,
            bottom: -80,
            width: 240,
            height: 240,
            borderRadius: "50%",
            opacity: 0.2,
            background: "radial-gradient(circle, #ec4899 0%, transparent 70%)",
          }}
        />
        <div 
          style={{
            position: "absolute",
            left: "50%",
            top: "33%",
            width: 160,
            height: 160,
            borderRadius: "50%",
            opacity: 0.15,
            background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)",
          }}
        />
        
        {/* Decorative grid */}
        <div 
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.05,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Content */}
        <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", padding: 32 }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 9999,
              padding: "8px 16px",
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 600, fontSize: 14 }}>{quizTitle}</span>
            </div>
            
            {playerName && (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Результат игрока {playerName}</p>
            )}
          </div>

          {/* Stars */}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 32 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <div
                key={star}
                style={{
                  position: "relative",
                  filter: star <= starCount ? "drop-shadow(0 0 12px rgba(168, 85, 247, 0.7))" : "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/icons/5.PNG" 
                  alt="" 
                  style={{ 
                    width: 40,
                    height: 40,
                    objectFit: "contain",
                    opacity: star <= starCount ? 1 : 0.25,
                    filter: star <= starCount ? "none" : "grayscale(1)",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Score */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div 
              style={{
                position: "relative",
                borderRadius: 24,
                padding: 32,
                marginBottom: 24,
                background: "linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(236,72,153,0.2) 100%)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textTransform: "uppercase", letterSpacing: 3, marginBottom: 8, textAlign: "center" }}>Результат</p>
              <p 
                style={{
                  fontSize: 60,
                  fontWeight: 900,
                  textAlign: "center",
                  margin: 0,
                  background: "linear-gradient(135deg, #fff 0%, #c4b5fd 50%, #f9a8d4 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {score.toLocaleString()}
              </p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", marginTop: 4 }}>очков</p>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 24 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", margin: 0 }}>{correctCount}/{totalQuestions}</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: 0 }}>верных</p>
              </div>
              <div style={{ width: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 24, fontWeight: 700, color: "#34d399", margin: 0 }}>{accuracy}%</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: 0 }}>точность</p>
              </div>
              <div style={{ width: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 24, fontWeight: 700, color: "#fbbf24", margin: 0 }}>🔥 {maxStreak}</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: 0 }}>серия</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 8 }}>💀 Попробуй побить мой рекорд!</p>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "rgba(139,92,246,0.2)",
              borderRadius: 9999,
              padding: "8px 16px",
            }}>
              <span style={{ color: "#c4b5fd", fontSize: 14, fontWeight: 500 }}>@truecrimetg_bot</span>
            </div>
          </div>
        </div>

        {/* Corner decorations */}
        <div style={{ position: "absolute", top: 16, left: 16, width: 32, height: 32, borderLeft: "2px solid rgba(139,92,246,0.3)", borderTop: "2px solid rgba(139,92,246,0.3)", borderTopLeftRadius: 8 }} />
        <div style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRight: "2px solid rgba(139,92,246,0.3)", borderTop: "2px solid rgba(139,92,246,0.3)", borderTopRightRadius: 8 }} />
        <div style={{ position: "absolute", bottom: 16, left: 16, width: 32, height: 32, borderLeft: "2px solid rgba(236,72,153,0.3)", borderBottom: "2px solid rgba(236,72,153,0.3)", borderBottomLeftRadius: 8 }} />
        <div style={{ position: "absolute", bottom: 16, right: 16, width: 32, height: 32, borderRight: "2px solid rgba(236,72,153,0.3)", borderBottom: "2px solid rgba(236,72,153,0.3)", borderBottomRightRadius: 8 }} />
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";
