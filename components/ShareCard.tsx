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
    
    // Rating text and color based on stars
    const getRating = () => {
      if (starCount >= 5) return { text: "ЛЕГЕНДА", color: "#fbbf24", glow: "rgba(251,191,36,0.6)" };
      if (starCount >= 4) return { text: "МАСТЕР", color: "#a855f7", glow: "rgba(168,85,247,0.6)" };
      if (starCount >= 3) return { text: "ДЕТЕКТИВ", color: "#3b82f6", glow: "rgba(59,130,246,0.6)" };
      if (starCount >= 2) return { text: "АГЕНТ", color: "#22c55e", glow: "rgba(34,197,94,0.6)" };
      if (starCount >= 1) return { text: "НОВИЧОК", color: "#64748b", glow: "rgba(100,116,139,0.5)" };
      return { text: "ПОПРОБУЙ ЕЩЁ", color: "#64748b", glow: "rgba(100,116,139,0.4)" };
    };
    
    const rating = getRating();
    
    return (
      <div
        ref={ref}
        style={{
          width: 540,
          height: 960,
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(180deg, #0a0a12 0%, #0f0a18 25%, #150d20 50%, #0f0a18 75%, #0a0a12 100%)",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* === ANIMATED BACKGROUND EFFECTS === */}
        
        {/* Main center glow */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: "35%",
          transform: "translate(-50%, -50%)",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${rating.glow} 0%, transparent 60%)`,
          filter: "blur(80px)",
        }} />
        
        {/* Top violet accent */}
        <div style={{
          position: "absolute",
          left: "30%",
          top: "5%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 60%)",
          filter: "blur(60px)",
        }} />
        
        {/* Bottom pink accent */}
        <div style={{
          position: "absolute",
          right: "10%",
          bottom: "15%",
          width: 350,
          height: 350,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236,72,153,0.3) 0%, transparent 60%)",
          filter: "blur(70px)",
        }} />
        
        {/* Left cyan accent for top performers */}
        {starCount >= 4 && (
          <div style={{
            position: "absolute",
            left: "-10%",
            top: "40%",
            width: 250,
            height: 250,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 60%)",
            filter: "blur(50px)",
          }} />
        )}
        
        {/* Decorative floating particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${5 + (i * 5) % 90}%`,
              top: `${8 + (i * 7) % 85}%`,
              width: i % 4 === 0 ? 6 : 4,
              height: i % 4 === 0 ? 6 : 4,
              borderRadius: "50%",
              background: i % 4 === 0 ? "#fbbf24" : i % 3 === 0 ? "#a855f7" : i % 2 === 0 ? "#ec4899" : "#3b82f6",
              opacity: 0.2 + (i % 5) * 0.1,
              boxShadow: `0 0 ${8 + i % 6}px currentColor`,
            }}
          />
        ))}
        
        {/* Subtle noise texture */}
        <div style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />

        {/* === CONTENT === */}
        <div style={{ 
          position: "relative", 
          height: "100%", 
          display: "flex", 
          flexDirection: "column", 
          padding: "48px 32px",
        }}>
          
          {/* TOP SECTION - Quiz Badge */}
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            marginBottom: 32,
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(236,72,153,0.1) 100%)",
              border: "1px solid rgba(139,92,246,0.25)",
              borderRadius: 100,
              padding: "14px 28px",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/icons/36.webp" 
                alt="" 
                style={{ width: 32, height: 32, objectFit: "contain" }}
              />
              <span style={{ 
                color: "rgba(255,255,255,0.95)", 
                fontWeight: 700, 
                fontSize: 18,
                letterSpacing: 0.5,
              }}>
                {quizTitle}
              </span>
            </div>
          </div>

          {/* RANK TITLE - Big and prominent */}
          <div style={{ 
            textAlign: "center",
            marginBottom: 20,
          }}>
            <div style={{
              display: "inline-block",
              position: "relative",
              padding: "12px 40px",
            }}>
              {/* Glowing background */}
              <div style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(135deg, ${rating.color}22 0%, ${rating.color}08 100%)`,
                border: `2px solid ${rating.color}44`,
                borderRadius: 16,
                boxShadow: `0 0 30px ${rating.glow}`,
              }} />
              <span style={{ 
                position: "relative",
                color: rating.color, 
                fontWeight: 900, 
                fontSize: 24,
                letterSpacing: 6,
                textTransform: "uppercase",
                textShadow: `0 0 30px ${rating.glow}`,
              }}>
                {rating.text}
              </span>
            </div>
          </div>

          {/* STARS SECTION - Using custom icons */}
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            gap: 12, 
            marginBottom: 40,
          }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <div
                key={star}
                style={{
                  position: "relative",
                  transform: star <= starCount ? "scale(1)" : "scale(0.7)",
                }}
              >
                {/* Star glow for active stars */}
                {star <= starCount && (
                  <div style={{
                    position: "absolute",
                    inset: -16,
                    background: "radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)",
                    borderRadius: "50%",
                    filter: "blur(12px)",
                  }} />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/icons/5.webp" 
                  alt="" 
                  style={{ 
                    position: "relative",
                    width: 56,
                    height: 56,
                    objectFit: "contain",
                    opacity: star <= starCount ? 1 : 0.15,
                    filter: star <= starCount 
                      ? "drop-shadow(0 0 12px rgba(251,191,36,0.8))" 
                      : "grayscale(1)",
                  }}
                />
              </div>
            ))}
          </div>

          {/* MAIN SCORE SECTION */}
          <div style={{ 
            flex: 1, 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            justifyContent: "center",
          }}>
            {/* Score Card - Glass morphism */}
            <div style={{
              position: "relative",
              width: "100%",
              maxWidth: 450,
              borderRadius: 36,
              padding: "40px 32px",
              background: "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}>
              {/* Top highlight */}
              <div style={{
                position: "absolute",
                top: 0,
                left: "15%",
                right: "15%",
                height: 1,
                background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)",
              }} />
              
              {/* Score header with trophy */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                marginBottom: 16,
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/icons/trophy.webp" 
                  alt="" 
                  style={{ width: 28, height: 28, objectFit: "contain" }}
                />
                <span style={{ 
                  color: "rgba(255,255,255,0.5)", 
                  fontSize: 14, 
                  textTransform: "uppercase", 
                  letterSpacing: 4, 
                  fontWeight: 700,
                }}>
                  Мой результат
                </span>
              </div>
              
              {/* Big Score Number */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                marginBottom: 8,
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/icons/coin.webp" 
                  alt="" 
                  style={{ width: 48, height: 48, objectFit: "contain" }}
                />
                <p style={{
                  fontSize: 84,
                  fontWeight: 900,
                  margin: 0,
                  lineHeight: 1,
                  background: "linear-gradient(135deg, #ffffff 0%, #e9d5ff 50%, #f9a8d4 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  {score.toLocaleString()}
                </p>
              </div>
              
              <p style={{ 
                color: "rgba(255,255,255,0.4)", 
                fontSize: 16, 
                textAlign: "center", 
                fontWeight: 600,
                letterSpacing: 2,
                marginBottom: 32,
              }}>
                очков
              </p>

              {/* Stats Grid */}
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between",
                gap: 16,
                paddingTop: 28,
                borderTop: "1px solid rgba(255,255,255,0.1)",
              }}>
                {/* Correct answers */}
                <div style={{ 
                  flex: 1,
                  textAlign: "center",
                  padding: "16px 8px",
                  background: "rgba(34,197,94,0.08)",
                  borderRadius: 16,
                  border: "1px solid rgba(34,197,94,0.15)",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/icons/38.webp" 
                    alt="" 
                    style={{ 
                      width: 32, 
                      height: 32, 
                      objectFit: "contain",
                      marginBottom: 8,
                    }}
                  />
                  <p style={{ 
                    fontSize: 28, 
                    fontWeight: 800, 
                    color: "#22c55e", 
                    margin: 0,
                    lineHeight: 1,
                  }}>
                    {correctCount}/{totalQuestions}
                  </p>
                  <p style={{ 
                    color: "rgba(255,255,255,0.5)", 
                    fontSize: 11, 
                    margin: 0,
                    marginTop: 6,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    fontWeight: 600,
                  }}>
                    верных
                  </p>
                </div>
                
                {/* Accuracy */}
                <div style={{ 
                  flex: 1,
                  textAlign: "center",
                  padding: "16px 8px",
                  background: accuracy >= 70 
                    ? "rgba(34,197,94,0.08)" 
                    : accuracy >= 50 
                    ? "rgba(251,191,36,0.08)" 
                    : "rgba(248,113,113,0.08)",
                  borderRadius: 16,
                  border: accuracy >= 70 
                    ? "1px solid rgba(34,197,94,0.15)" 
                    : accuracy >= 50 
                    ? "1px solid rgba(251,191,36,0.15)" 
                    : "1px solid rgba(248,113,113,0.15)",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/icons/medal.webp" 
                    alt="" 
                    style={{ 
                      width: 32, 
                      height: 32, 
                      objectFit: "contain",
                      marginBottom: 8,
                    }}
                  />
                  <p style={{ 
                    fontSize: 28, 
                    fontWeight: 800, 
                    color: accuracy >= 70 ? "#22c55e" : accuracy >= 50 ? "#fbbf24" : "#f87171", 
                    margin: 0,
                    lineHeight: 1,
                  }}>
                    {accuracy}%
                  </p>
                  <p style={{ 
                    color: "rgba(255,255,255,0.5)", 
                    fontSize: 11, 
                    margin: 0,
                    marginTop: 6,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    fontWeight: 600,
                  }}>
                    точность
                  </p>
                </div>
                
                {/* Streak */}
                <div style={{ 
                  flex: 1,
                  textAlign: "center",
                  padding: "16px 8px",
                  background: "rgba(251,191,36,0.08)",
                  borderRadius: 16,
                  border: "1px solid rgba(251,191,36,0.15)",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/icons/fire-medal.webp" 
                    alt="" 
                    style={{ 
                      width: 32, 
                      height: 32, 
                      objectFit: "contain",
                      marginBottom: 8,
                    }}
                  />
                  <p style={{ 
                    fontSize: 28, 
                    fontWeight: 800, 
                    color: "#fbbf24", 
                    margin: 0,
                    lineHeight: 1,
                  }}>
                    {maxStreak}
                  </p>
                  <p style={{ 
                    color: "rgba(255,255,255,0.5)", 
                    fontSize: 11, 
                    margin: 0,
                    marginTop: 6,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    fontWeight: 600,
                  }}>
                    серия
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER SECTION */}
          <div style={{ 
            marginTop: 32,
            textAlign: "center",
          }}>
            {/* Player name if available */}
            {playerName && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 20,
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/icons/51.webp" 
                  alt="" 
                  style={{ width: 24, height: 24, objectFit: "contain" }}
                />
                <span style={{ 
                  color: "rgba(255,255,255,0.7)", 
                  fontSize: 16, 
                  fontWeight: 600,
                }}>
                  {playerName}
                </span>
              </div>
            )}
            
            {/* Challenge button */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              background: "linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(236,72,153,0.2) 100%)",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: 20,
              padding: "18px 32px",
              marginBottom: 24,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/icons/49.webp" 
                alt="" 
                style={{ width: 28, height: 28, objectFit: "contain" }}
              />
              <span style={{ 
                color: "rgba(255,255,255,0.95)", 
                fontSize: 18, 
                fontWeight: 700,
                letterSpacing: 0.5,
              }}>
                Сможешь лучше?
              </span>
            </div>
            
            {/* Bot link with indicator */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 12px #22c55e, 0 0 24px #22c55e",
              }} />
              <span style={{ 
                color: "#a78bfa", 
                fontSize: 18, 
                fontWeight: 700,
                letterSpacing: 1,
              }}>
                @truecrimetg_bot
              </span>
            </div>
          </div>
        </div>

        {/* === DECORATIVE CORNER FRAMES === */}
        {/* Top left */}
        <div style={{ 
          position: "absolute", 
          top: 20, 
          left: 20, 
          width: 60, 
          height: 60, 
          borderLeft: "3px solid rgba(139,92,246,0.5)", 
          borderTop: "3px solid rgba(139,92,246,0.5)", 
          borderTopLeftRadius: 16,
        }} />
        {/* Top right */}
        <div style={{ 
          position: "absolute", 
          top: 20, 
          right: 20, 
          width: 60, 
          height: 60, 
          borderRight: "3px solid rgba(139,92,246,0.5)", 
          borderTop: "3px solid rgba(139,92,246,0.5)", 
          borderTopRightRadius: 16,
        }} />
        {/* Bottom left */}
        <div style={{ 
          position: "absolute", 
          bottom: 20, 
          left: 20, 
          width: 60, 
          height: 60, 
          borderLeft: "3px solid rgba(236,72,153,0.5)", 
          borderBottom: "3px solid rgba(236,72,153,0.5)", 
          borderBottomLeftRadius: 16,
        }} />
        {/* Bottom right */}
        <div style={{ 
          position: "absolute", 
          bottom: 20, 
          right: 20, 
          width: 60, 
          height: 60, 
          borderRight: "3px solid rgba(236,72,153,0.5)", 
          borderBottom: "3px solid rgba(236,72,153,0.5)", 
          borderBottomRightRadius: 16,
        }} />
        
        {/* Gradient border overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          border: "1px solid transparent",
          background: "linear-gradient(180deg, rgba(139,92,246,0.15) 0%, transparent 30%, transparent 70%, rgba(236,72,153,0.15) 100%) border-box",
          pointerEvents: "none",
        }} />
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";
