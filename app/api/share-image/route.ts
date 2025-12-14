import { NextRequest, NextResponse } from "next/server";

/**
 * Generate beautiful share images using htmlcsstoimage.com
 * Design: Cyberpunk Neon Detective File
 */

const HCTI_USER_ID = process.env.HCTI_USER_ID;
const HCTI_API_KEY = process.env.HCTI_API_KEY;

export async function POST(request: NextRequest) {
  if (!HCTI_USER_ID || !HCTI_API_KEY) {
    return NextResponse.json(
      { error: "HCTI credentials not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {
      quizTitle = "True Crime Quiz",
      score = 0,
      correct = 0,
      total = 10,
      streak = 0,
      stars = 3,
      player = "",
      rank = 0,
    } = body;

    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    // Generate rank title based on accuracy
    const getRankTitle = (acc: number) => {
      if (acc >= 100) return { title: "ЛЕГЕНДА", color: "#ffd700", glow: "rgba(255, 215, 0, 0.8)" };
      if (acc >= 80) return { title: "ДЕТЕКТИВ", color: "#a855f7", glow: "rgba(168, 85, 247, 0.8)" };
      if (acc >= 60) return { title: "СЛЕДОВАТЕЛЬ", color: "#3b82f6", glow: "rgba(59, 130, 246, 0.8)" };
      if (acc >= 40) return { title: "АГЕНТ", color: "#22c55e", glow: "rgba(34, 197, 94, 0.8)" };
      return { title: "НОВИЧОК", color: "#94a3b8", glow: "rgba(148, 163, 184, 0.5)" };
    };
    
    const rankInfo = getRankTitle(accuracy);
    
    // Generate stars HTML with neon glow
    const starsHtml = [1, 2, 3, 4, 5]
      .map(
        (star) =>
          `<div class="star ${star <= stars ? "active" : ""}">
            <svg viewBox="0 0 24 24" fill="${star <= stars ? "#fbbf24" : "#1e1e2e"}">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>`
      )
      .join("");

    // Cyberpunk Neon Detective HTML
    const html = `
      <div class="card">
        <!-- Animated background grid -->
        <div class="grid-bg"></div>
        
        <!-- Neon glow effects -->
        <div class="neon-orb neon-1"></div>
        <div class="neon-orb neon-2"></div>
        <div class="neon-orb neon-3"></div>
        
        <!-- Scan lines effect -->
        <div class="scanlines"></div>
        
        <!-- Top bar -->
        <div class="top-bar">
          <div class="status-dot"></div>
          <span class="case-id">CASE #${Math.floor(Math.random() * 9000) + 1000}</span>
          <span class="classification">◉ CLASSIFIED</span>
        </div>
        
        <div class="content">
          <!-- Holographic badge -->
          <div class="holo-badge">
            <div class="badge-inner">
              <span class="badge-icon">🔍</span>
              <span class="badge-text">${quizTitle}</span>
            </div>
            <div class="badge-shine"></div>
          </div>
          
          <!-- Agent info -->
          ${player ? `
          <div class="agent-block">
            <span class="agent-label">АГЕНТ</span>
            <span class="agent-name">${player.toUpperCase()}</span>
          </div>
          ` : ""}
          
          <!-- Rank display -->
          <div class="rank-display" style="--rank-color: ${rankInfo.color}; --rank-glow: ${rankInfo.glow}">
            <span class="rank-title">${rankInfo.title}</span>
          </div>
          
          <!-- Stars container -->
          <div class="stars-container">
            ${starsHtml}
          </div>
          
          <!-- Main score display -->
          <div class="score-container">
            <div class="score-ring">
              <div class="score-inner">
                <span class="score-number">${score.toLocaleString()}</span>
                <span class="score-label">ОЧКОВ</span>
              </div>
            </div>
          </div>
          
          <!-- Stats grid -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">✓</div>
              <div class="stat-value">${correct}/${total}</div>
              <div class="stat-label">ВЕРНЫХ</div>
            </div>
            <div class="stat-card accent">
              <div class="stat-icon">◎</div>
              <div class="stat-value">${accuracy}%</div>
              <div class="stat-label">ТОЧНОСТЬ</div>
            </div>
            <div class="stat-card fire">
              <div class="stat-icon">🔥</div>
              <div class="stat-value">${streak}</div>
              <div class="stat-label">СЕРИЯ</div>
            </div>
          </div>
          
          ${rank > 0 ? `
          <div class="leaderboard-pos">
            <span class="lb-icon">👑</span>
            <span class="lb-text">#${rank} В РЕЙТИНГЕ</span>
          </div>
          ` : ""}
        </div>
        
        <!-- Bottom CTA -->
        <div class="bottom-cta">
          <div class="cta-text">💀 ПОПРОБУЙ ПОБИТЬ МОЙ РЕКОРД</div>
          <div class="bot-link">
            <span class="tg-icon">✈</span>
            <span>@truecrimetg_bot</span>
          </div>
        </div>
        
        <!-- Corner accents -->
        <div class="corner-accent tl"></div>
        <div class="corner-accent tr"></div>
        <div class="corner-accent bl"></div>
        <div class="corner-accent br"></div>
      </div>
    `;

    const css = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@400;600;700&display=swap');
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      .card {
        width: 600px;
        height: 900px;
        background: linear-gradient(180deg, #0a0a0f 0%, #12121a 50%, #0a0a0f 100%);
        position: relative;
        overflow: hidden;
        font-family: 'Inter', sans-serif;
      }
      
      /* Grid background */
      .grid-bg {
        position: absolute;
        inset: 0;
        background-image: 
          linear-gradient(rgba(139, 92, 246, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(139, 92, 246, 0.03) 1px, transparent 1px);
        background-size: 30px 30px;
      }
      
      /* Neon orbs */
      .neon-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(60px);
      }
      
      .neon-1 {
        width: 300px;
        height: 300px;
        left: -100px;
        top: -50px;
        background: rgba(139, 92, 246, 0.4);
      }
      
      .neon-2 {
        width: 250px;
        height: 250px;
        right: -80px;
        bottom: 100px;
        background: rgba(236, 72, 153, 0.35);
      }
      
      .neon-3 {
        width: 200px;
        height: 200px;
        left: 50%;
        top: 40%;
        transform: translateX(-50%);
        background: rgba(6, 182, 212, 0.2);
      }
      
      /* Scanlines */
      .scanlines {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 0, 0, 0.1) 2px,
          rgba(0, 0, 0, 0.1) 4px
        );
        pointer-events: none;
      }
      
      /* Top bar */
      .top-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        background: rgba(0, 0, 0, 0.5);
        border-bottom: 1px solid rgba(139, 92, 246, 0.3);
        font-family: 'Orbitron', monospace;
        font-size: 11px;
        letter-spacing: 2px;
      }
      
      .status-dot {
        width: 8px;
        height: 8px;
        background: #22c55e;
        border-radius: 50%;
        box-shadow: 0 0 10px #22c55e;
      }
      
      .case-id {
        color: rgba(255, 255, 255, 0.6);
      }
      
      .classification {
        color: #ef4444;
        text-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
      }
      
      /* Content */
      .content {
        position: relative;
        z-index: 10;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 70px 40px 100px;
        height: 100%;
      }
      
      /* Holographic badge */
      .holo-badge {
        position: relative;
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 60px;
        padding: 14px 28px;
        margin-bottom: 16px;
        overflow: hidden;
      }
      
      .badge-inner {
        display: flex;
        align-items: center;
        gap: 10px;
        position: relative;
        z-index: 2;
      }
      
      .badge-icon {
        font-size: 20px;
      }
      
      .badge-text {
        color: #fff;
        font-weight: 600;
        font-size: 16px;
      }
      
      .badge-shine {
        position: absolute;
        top: 0;
        left: -100%;
        width: 50%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        transform: skewX(-20deg);
      }
      
      /* Agent block */
      .agent-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .agent-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.4);
        letter-spacing: 3px;
        font-family: 'Orbitron', monospace;
      }
      
      .agent-name {
        font-size: 18px;
        font-weight: 700;
        color: #fff;
        letter-spacing: 2px;
        font-family: 'Orbitron', monospace;
      }
      
      /* Rank display */
      .rank-display {
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3));
        border: 2px solid var(--rank-color);
        border-radius: 8px;
        padding: 8px 24px;
        margin-bottom: 20px;
        box-shadow: 0 0 20px var(--rank-glow), inset 0 0 20px rgba(0, 0, 0, 0.5);
      }
      
      .rank-title {
        font-family: 'Orbitron', monospace;
        font-size: 14px;
        font-weight: 700;
        color: var(--rank-color);
        letter-spacing: 4px;
        text-shadow: 0 0 10px var(--rank-glow);
      }
      
      /* Stars */
      .stars-container {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
      }
      
      .star {
        width: 40px;
        height: 40px;
        opacity: 0.2;
      }
      
      .star.active {
        opacity: 1;
        filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.8));
      }
      
      .star svg {
        width: 100%;
        height: 100%;
      }
      
      /* Score container */
      .score-container {
        margin-bottom: 28px;
      }
      
      .score-ring {
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: conic-gradient(from 0deg, #8b5cf6, #ec4899, #06b6d4, #8b5cf6);
        padding: 4px;
        box-shadow: 0 0 40px rgba(139, 92, 246, 0.4), 0 0 80px rgba(236, 72, 153, 0.2);
      }
      
      .score-inner {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: linear-gradient(135deg, #12121a 0%, #1a1a2e 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      
      .score-number {
        font-family: 'Orbitron', monospace;
        font-size: 48px;
        font-weight: 900;
        background: linear-gradient(135deg, #fff 0%, #c4b5fd 50%, #f9a8d4 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        line-height: 1;
      }
      
      .score-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        letter-spacing: 4px;
        margin-top: 4px;
        font-family: 'Orbitron', monospace;
      }
      
      /* Stats grid */
      .stats-grid {
        display: flex;
        gap: 16px;
        margin-bottom: 20px;
      }
      
      .stat-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 16px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 100px;
      }
      
      .stat-card.accent {
        border-color: rgba(34, 197, 94, 0.3);
        background: rgba(34, 197, 94, 0.05);
      }
      
      .stat-card.fire {
        border-color: rgba(251, 191, 36, 0.3);
        background: rgba(251, 191, 36, 0.05);
      }
      
      .stat-icon {
        font-size: 18px;
        margin-bottom: 6px;
        color: rgba(255, 255, 255, 0.6);
      }
      
      .stat-card.accent .stat-icon {
        color: #22c55e;
      }
      
      .stat-value {
        font-family: 'Orbitron', monospace;
        font-size: 22px;
        font-weight: 700;
        color: #fff;
      }
      
      .stat-card.accent .stat-value {
        color: #22c55e;
        text-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
      }
      
      .stat-card.fire .stat-value {
        color: #fbbf24;
        text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
      }
      
      .stat-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.4);
        letter-spacing: 2px;
        margin-top: 4px;
        font-family: 'Orbitron', monospace;
      }
      
      /* Leaderboard position */
      .leaderboard-pos {
        display: flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%);
        border: 1px solid rgba(251, 191, 36, 0.3);
        border-radius: 50px;
        padding: 10px 24px;
        margin-bottom: 16px;
      }
      
      .lb-icon {
        font-size: 18px;
      }
      
      .lb-text {
        font-family: 'Orbitron', monospace;
        font-size: 12px;
        font-weight: 600;
        color: #fbbf24;
        letter-spacing: 2px;
      }
      
      /* Bottom CTA */
      .bottom-cta {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.8) 100%);
        padding: 30px 40px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      
      .cta-text {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
        letter-spacing: 1px;
      }
      
      .bot-link {
        display: flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
        border-radius: 50px;
        padding: 12px 28px;
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
      }
      
      .tg-icon {
        font-size: 16px;
      }
      
      .bot-link span:last-child {
        font-weight: 600;
        font-size: 14px;
        color: #fff;
        letter-spacing: 1px;
      }
      
      /* Corner accents */
      .corner-accent {
        position: absolute;
        width: 60px;
        height: 60px;
      }
      
      .corner-accent.tl {
        top: 50px;
        left: 16px;
        border-left: 2px solid rgba(139, 92, 246, 0.5);
        border-top: 2px solid rgba(139, 92, 246, 0.5);
      }
      
      .corner-accent.tr {
        top: 50px;
        right: 16px;
        border-right: 2px solid rgba(139, 92, 246, 0.5);
        border-top: 2px solid rgba(139, 92, 246, 0.5);
      }
      
      .corner-accent.bl {
        bottom: 16px;
        left: 16px;
        border-left: 2px solid rgba(236, 72, 153, 0.5);
        border-bottom: 2px solid rgba(236, 72, 153, 0.5);
      }
      
      .corner-accent.br {
        bottom: 16px;
        right: 16px;
        border-right: 2px solid rgba(236, 72, 153, 0.5);
        border-bottom: 2px solid rgba(236, 72, 153, 0.5);
      }
    `;

    // Call htmlcsstoimage API
    const response = await fetch("https://hcti.io/v1/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          `${HCTI_USER_ID}:${HCTI_API_KEY}`
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        html,
        css,
        google_fonts: "Inter",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HCTI API error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate image" },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      url: result.url,
    });
  } catch (error) {
    console.error("Share image error:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}

