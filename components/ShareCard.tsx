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
    
    // Rating text based on stars
    const ratingText = starCount >= 5 ? "ЛЕГЕНДА" 
      : starCount >= 4 ? "МАСТЕР" 
      : starCount >= 3 ? "ДЕТЕКТИВ"
      : starCount >= 2 ? "АГЕНТ"
      : starCount >= 1 ? "НОВИЧОК"
      : "ПОПРОБУЙ ЕЩЁ";
    
    // Color theme based on performance
    const themeColor = starCount >= 4 ? "#fbbf24" : starCount >= 2 ? "#a855f7" : "#64748b";
    
    return (
      <div
        ref={ref}
        style={{
          width: 400,
          height: 600,
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(165deg, #0c0c14 0%, #1a0f24 35%, #120a1c 65%, #0a0a0f 100%)",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* === ANIMATED BACKGROUND EFFECTS === */}
        
        {/* Main glow - violet */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: "30%",
          transform: "translate(-50%, -50%)",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 60%)",
          filter: "blur(40px)",
        }} />
        
        {/* Secondary glow - pink */}
        <div style={{
          position: "absolute",
          right: -60,
          bottom: 100,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236,72,153,0.35) 0%, transparent 60%)",
          filter: "blur(30px)",
        }} />
        
        {/* Accent glow - cyan for top performers */}
        {starCount >= 4 && (
          <div style={{
            position: "absolute",
            left: -40,
            top: 80,
            width: 150,
            height: 150,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 60%)",
            filter: "blur(25px)",
          }} />
        )}
        
        {/* Decorative particles */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${10 + (i * 8) % 80}%`,
              top: `${15 + (i * 13) % 70}%`,
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: i % 3 === 0 ? "#a855f7" : i % 3 === 1 ? "#ec4899" : "#fbbf24",
              opacity: 0.3 + (i % 4) * 0.1,
              boxShadow: `0 0 ${6 + i % 4}px currentColor`,
            }}
          />
        ))}
        
        {/* Subtle grid pattern */}
        <div style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }} />

        {/* === CONTENT === */}
        <div style={{ 
          position: "relative", 
          height: "100%", 
          display: "flex", 
          flexDirection: "column", 
          padding: "28px 24px",
        }}>
          
          {/* TOP BADGE */}
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            marginBottom: 16,
          }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(236,72,153,0.15) 100%)",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: 100,
              padding: "10px 20px",
              backdropFilter: "blur(10px)",
            }}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <span style={{ 
                color: "rgba(255,255,255,0.9)", 
                fontWeight: 700, 
                fontSize: 15,
                letterSpacing: 0.5,
              }}>
                {quizTitle}
              </span>
            </div>
          </div>

          {/* RANK BADGE */}
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            marginBottom: 20,
          }}>
            <div style={{
              position: "relative",
              padding: "6px 24px",
            }}>
              {/* Glowing background for rank */}
              <div style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(135deg, ${themeColor}33 0%, ${themeColor}11 100%)`,
                border: `1px solid ${themeColor}44`,
                borderRadius: 8,
              }} />
              <span style={{ 
                position: "relative",
                color: themeColor, 
                fontWeight: 900, 
                fontSize: 13,
                letterSpacing: 4,
                textTransform: "uppercase",
              }}>
                {ratingText}
              </span>
            </div>
          </div>

          {/* STARS - Big and prominent */}
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            gap: 8, 
            marginBottom: 28,
          }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <div
                key={star}
                style={{
                  position: "relative",
                  transform: star <= starCount ? "scale(1)" : "scale(0.85)",
                  transition: "transform 0.3s",
                }}
              >
                {/* Star glow */}
                {star <= starCount && (
                  <div style={{
                    position: "absolute",
                    inset: -8,
                    background: "radial-gradient(circle, rgba(251,191,36,0.5) 0%, transparent 70%)",
                    borderRadius: "50%",
                    filter: "blur(8px)",
                  }} />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/icons/5.PNG" 
                  alt="" 
                  style={{ 
                    position: "relative",
                    width: 44,
                    height: 44,
                    objectFit: "contain",
                    opacity: star <= starCount ? 1 : 0.2,
                    filter: star <= starCount ? "drop-shadow(0 0 8px rgba(251,191,36,0.6))" : "grayscale(1)",
                  }}
                />
              </div>
            ))}
          </div>

          {/* MAIN SCORE DISPLAY */}
          <div style={{ 
            flex: 1, 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            justifyContent: "center",
          }}>
            {/* Score Card */}
            <div style={{
              position: "relative",
              width: "100%",
              maxWidth: 320,
              borderRadius: 28,
              padding: "32px 24px",
              background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}>
              {/* Inner glow effect */}
              <div style={{
                position: "absolute",
                top: -1,
                left: "10%",
                right: "10%",
                height: 1,
                background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.5), transparent)",
              }} />
              
              <p style={{ 
                color: "rgba(255,255,255,0.4)", 
                fontSize: 11, 
                textTransform: "uppercase", 
                letterSpacing: 4, 
                textAlign: "center",
                marginBottom: 8,
                fontWeight: 600,
              }}>
                Мой результат
              </p>
              
              {/* Big Score Number */}
              <p style={{
                fontSize: 72,
                fontWeight: 900,
                textAlign: "center",
                margin: 0,
                lineHeight: 1,
                background: "linear-gradient(135deg, #ffffff 0%, #e9d5ff 40%, #f9a8d4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 0 60px rgba(139,92,246,0.5)",
              }}>
                {score.toLocaleString()}
              </p>
              
              <p style={{ 
                color: "rgba(255,255,255,0.35)", 
                fontSize: 14, 
                textAlign: "center", 
                marginTop: 4,
                fontWeight: 500,
              }}>
                очков
              </p>

              {/* Stats Row */}
              <div style={{ 
                display: "flex", 
                justifyContent: "center",
                gap: 32,
                marginTop: 28,
                paddingTop: 24,
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}>
                {/* Correct answers */}
                <div style={{ textAlign: "center" }}>
                  <p style={{ 
                    fontSize: 28, 
                    fontWeight: 800, 
                    color: "#ffffff", 
                    margin: 0,
                    lineHeight: 1,
                  }}>
                    {correctCount}<span style={{ color: "rgba(255,255,255,0.3)" }}>/{totalQuestions}</span>
                  </p>
                  <p style={{ 
                    color: "rgba(255,255,255,0.4)", 
                    fontSize: 11, 
                    margin: 0,
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}>
                    верных
                  </p>
                </div>
                
                {/* Accuracy */}
                <div style={{ textAlign: "center" }}>
                  <p style={{ 
                    fontSize: 28, 
                    fontWeight: 800, 
                    color: accuracy >= 70 ? "#34d399" : accuracy >= 50 ? "#fbbf24" : "#f87171", 
                    margin: 0,
                    lineHeight: 1,
                  }}>
                    {accuracy}%
                  </p>
                  <p style={{ 
                    color: "rgba(255,255,255,0.4)", 
                    fontSize: 11, 
                    margin: 0,
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}>
                    точность
                  </p>
                </div>
                
                {/* Streak */}
                <div style={{ textAlign: "center" }}>
                  <p style={{ 
                    fontSize: 28, 
                    fontWeight: 800, 
                    color: "#fbbf24", 
                    margin: 0,
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}>
                    <span style={{ fontSize: 22 }}>🔥</span>{maxStreak}
                  </p>
                  <p style={{ 
                    color: "rgba(255,255,255,0.4)", 
                    fontSize: 11, 
                    margin: 0,
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}>
                    серия
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER - Call to action */}
          <div style={{ 
            marginTop: 24,
            textAlign: "center",
          }}>
            {/* Player name if available */}
            {playerName && (
              <p style={{ 
                color: "rgba(255,255,255,0.5)", 
                fontSize: 13, 
                marginBottom: 12,
              }}>
                Игрок: <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{playerName}</span>
              </p>
            )}
            
            {/* Challenge text */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(236,72,153,0.15) 100%)",
              border: "1px solid rgba(139,92,246,0.25)",
              borderRadius: 16,
              padding: "14px 24px",
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 18 }}>💀</span>
              <span style={{ 
                color: "rgba(255,255,255,0.9)", 
                fontSize: 15, 
                fontWeight: 600,
              }}>
                Сможешь лучше? Проверь себя!
              </span>
            </div>
            
            {/* Bot link */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 8px #22c55e",
              }} />
              <span style={{ 
                color: "#a78bfa", 
                fontSize: 14, 
                fontWeight: 600,
                letterSpacing: 0.5,
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
          top: 12, 
          left: 12, 
          width: 40, 
          height: 40, 
          borderLeft: "2px solid rgba(139,92,246,0.4)", 
          borderTop: "2px solid rgba(139,92,246,0.4)", 
          borderTopLeftRadius: 12,
        }} />
        {/* Top right */}
        <div style={{ 
          position: "absolute", 
          top: 12, 
          right: 12, 
          width: 40, 
          height: 40, 
          borderRight: "2px solid rgba(139,92,246,0.4)", 
          borderTop: "2px solid rgba(139,92,246,0.4)", 
          borderTopRightRadius: 12,
        }} />
        {/* Bottom left */}
        <div style={{ 
          position: "absolute", 
          bottom: 12, 
          left: 12, 
          width: 40, 
          height: 40, 
          borderLeft: "2px solid rgba(236,72,153,0.4)", 
          borderBottom: "2px solid rgba(236,72,153,0.4)", 
          borderBottomLeftRadius: 12,
        }} />
        {/* Bottom right */}
        <div style={{ 
          position: "absolute", 
          bottom: 12, 
          right: 12, 
          width: 40, 
          height: 40, 
          borderRight: "2px solid rgba(236,72,153,0.4)", 
          borderBottom: "2px solid rgba(236,72,153,0.4)", 
          borderBottomRightRadius: 12,
        }} />
        
        {/* Animated border glow */}
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: 0,
          border: "1px solid transparent",
          background: "linear-gradient(135deg, rgba(139,92,246,0.1), transparent, rgba(236,72,153,0.1)) border-box",
          WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          pointerEvents: "none",
        }} />
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";
