import { NextRequest, NextResponse } from "next/server";

/**
 * Generate beautiful share images for Stories using htmlcsstoimage.com
 * Format: 9:16 (540x960 - will be scaled up by service)
 * Style: True Crime Neon Detective
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
      total = 5,
      streak = 0,
      stars = 3,
      player = "",
    } = body;

    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    // Generate rank based on stars
    const getRankInfo = (starCount: number) => {
      if (starCount >= 5) return { 
        title: "ЛЕГЕНДА", 
        color: "#fbbf24", 
        glow: "rgba(251, 191, 36, 0.6)",
        gradient: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
      };
      if (starCount >= 4) return { 
        title: "МАСТЕР", 
        color: "#a855f7", 
        glow: "rgba(168, 85, 247, 0.6)",
        gradient: "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)"
      };
      if (starCount >= 3) return { 
        title: "ДЕТЕКТИВ", 
        color: "#3b82f6", 
        glow: "rgba(59, 130, 246, 0.6)",
        gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
      };
      if (starCount >= 2) return { 
        title: "АГЕНТ", 
        color: "#22c55e", 
        glow: "rgba(34, 197, 94, 0.5)",
        gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
      };
      if (starCount >= 1) return { 
        title: "НОВИЧОК", 
        color: "#64748b", 
        glow: "rgba(100, 116, 139, 0.4)",
        gradient: "linear-gradient(135deg, #64748b 0%, #475569 100%)"
      };
      return { 
        title: "ПОПРОБУЙ ЕЩЁ", 
        color: "#64748b", 
        glow: "rgba(100, 116, 139, 0.3)",
        gradient: "linear-gradient(135deg, #64748b 0%, #475569 100%)"
      };
    };
    
    const rankInfo = getRankInfo(stars);
    
    // Generate stars HTML with custom styling
    const starsHtml = [1, 2, 3, 4, 5]
      .map(
        (star) =>
          `<div class="star ${star <= stars ? "active" : "inactive"}">
            <svg viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>`
      )
      .join("");

    // Get accuracy color
    const getAccuracyColor = (acc: number) => {
      if (acc >= 80) return "#22c55e";
      if (acc >= 60) return "#fbbf24";
      if (acc >= 40) return "#f97316";
      return "#ef4444";
    };

    const html = `
      <div class="card">
        <!-- Background effects -->
        <div class="bg-gradient"></div>
        <div class="glow glow-1"></div>
        <div class="glow glow-2"></div>
        <div class="glow glow-3"></div>
        
        <!-- Floating particles -->
        ${[...Array(16)].map((_, i) => `
          <div class="particle" style="
            left: ${8 + (i * 6) % 85}%;
            top: ${10 + (i * 7) % 80}%;
            width: ${i % 3 === 0 ? 6 : 4}px;
            height: ${i % 3 === 0 ? 6 : 4}px;
            background: ${i % 4 === 0 ? '#fbbf24' : i % 3 === 0 ? '#a855f7' : i % 2 === 0 ? '#ec4899' : '#3b82f6'};
            opacity: ${0.2 + (i % 5) * 0.1};
          "></div>
        `).join('')}
        
        <!-- Content -->
        <div class="content">
          
          <!-- Quiz badge -->
          <div class="quiz-badge">
            <span class="badge-icon">🔍</span>
            <span class="badge-text">${quizTitle}</span>
          </div>
          
          <!-- Player name -->
          ${player ? `
          <div class="player-name">
            <span class="player-icon">👤</span>
            <span>${player}</span>
          </div>
          ` : ''}
          
          <!-- Rank title -->
          <div class="rank-container" style="--rank-color: ${rankInfo.color}; --rank-glow: ${rankInfo.glow};">
            <div class="rank-badge">
              <span class="rank-text">${rankInfo.title}</span>
            </div>
          </div>
          
          <!-- Stars -->
          <div class="stars-container">
            ${starsHtml}
          </div>
          
          <!-- Score card -->
          <div class="score-card">
            <div class="score-header">
              <span class="trophy">🏆</span>
              <span>МОЙ РЕЗУЛЬТАТ</span>
            </div>
            
            <div class="score-value">
              <span class="coin">💰</span>
              <span class="score-number">${score.toLocaleString()}</span>
            </div>
            <div class="score-label">очков</div>
            
            <!-- Stats row -->
            <div class="stats-row">
              <div class="stat-item stat-correct">
                <div class="stat-icon">✅</div>
                <div class="stat-value">${correct}/${total}</div>
                <div class="stat-label">верных</div>
              </div>
              
              <div class="stat-item stat-accuracy" style="--acc-color: ${getAccuracyColor(accuracy)};">
                <div class="stat-icon">🎯</div>
                <div class="stat-value">${accuracy}%</div>
                <div class="stat-label">точность</div>
              </div>
              
              <div class="stat-item stat-streak">
                <div class="stat-icon">🔥</div>
                <div class="stat-value">${streak}</div>
                <div class="stat-label">серия</div>
              </div>
            </div>
          </div>
          
          <!-- CTA -->
          <div class="cta-section">
            <div class="cta-challenge">
              <span>💀</span>
              <span>Сможешь лучше?</span>
            </div>
            
            <div class="bot-link">
              <div class="online-dot"></div>
              <span>@truecrimetg_bot</span>
            </div>
          </div>
        </div>
        
        <!-- Corner frames -->
        <div class="corner tl"></div>
        <div class="corner tr"></div>
        <div class="corner bl"></div>
        <div class="corner br"></div>
      </div>
    `;

    const css = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      .card {
        width: 540px;
        height: 960px;
        position: relative;
        overflow: hidden;
        font-family: 'Inter', -apple-system, sans-serif;
      }
      
      /* Background */
      .bg-gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, 
          #0a0a12 0%, 
          #0f0a18 25%, 
          #150d20 50%, 
          #0f0a18 75%, 
          #0a0a12 100%
        );
      }
      
      /* Glows */
      .glow {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
      }
      
      .glow-1 {
        width: 400px;
        height: 400px;
        left: 50%;
        top: 30%;
        transform: translateX(-50%);
        background: ${rankInfo.glow};
      }
      
      .glow-2 {
        width: 300px;
        height: 300px;
        left: 20%;
        top: 5%;
        background: rgba(139, 92, 246, 0.35);
      }
      
      .glow-3 {
        width: 350px;
        height: 350px;
        right: 5%;
        bottom: 10%;
        background: rgba(236, 72, 153, 0.25);
      }
      
      /* Particles */
      .particle {
        position: absolute;
        border-radius: 50%;
        box-shadow: 0 0 8px currentColor;
      }
      
      /* Content */
      .content {
        position: relative;
        z-index: 10;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px 32px;
      }
      
      /* Quiz badge */
      .quiz-badge {
        display: flex;
        align-items: center;
        gap: 12px;
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.1) 100%);
        border: 1px solid rgba(139, 92, 246, 0.25);
        border-radius: 100px;
        padding: 14px 28px;
        margin-bottom: 20px;
      }
      
      .badge-icon {
        font-size: 24px;
      }
      
      .badge-text {
        color: rgba(255, 255, 255, 0.95);
        font-weight: 700;
        font-size: 18px;
      }
      
      /* Player name */
      .player-name {
        display: flex;
        align-items: center;
        gap: 10px;
        color: rgba(255, 255, 255, 0.7);
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 16px;
      }
      
      .player-icon {
        font-size: 18px;
      }
      
      /* Rank container */
      .rank-container {
        margin-bottom: 24px;
      }
      
      .rank-badge {
        position: relative;
        padding: 14px 40px;
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
        border: 2px solid var(--rank-color);
        border-radius: 16px;
        box-shadow: 0 0 30px var(--rank-glow), 0 0 60px var(--rank-glow);
      }
      
      .rank-text {
        font-size: 22px;
        font-weight: 900;
        color: var(--rank-color);
        letter-spacing: 6px;
        text-shadow: 0 0 30px var(--rank-glow);
      }
      
      /* Stars */
      .stars-container {
        display: flex;
        gap: 12px;
        margin-bottom: 32px;
      }
      
      .star {
        width: 52px;
        height: 52px;
      }
      
      .star svg {
        width: 100%;
        height: 100%;
      }
      
      .star.active svg {
        fill: #fbbf24;
        filter: drop-shadow(0 0 12px rgba(251, 191, 36, 0.8));
      }
      
      .star.inactive svg {
        fill: rgba(255, 255, 255, 0.1);
      }
      
      /* Score card */
      .score-card {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        max-width: 440px;
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 32px;
        padding: 36px 28px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
      }
      
      .score-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      }
      
      .trophy {
        font-size: 24px;
      }
      
      .score-header span:last-child {
        color: rgba(255, 255, 255, 0.5);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 4px;
      }
      
      .score-value {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .coin {
        font-size: 40px;
      }
      
      .score-number {
        font-size: 72px;
        font-weight: 900;
        background: linear-gradient(135deg, #ffffff 0%, #e9d5ff 50%, #f9a8d4 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        line-height: 1;
      }
      
      .score-label {
        color: rgba(255, 255, 255, 0.4);
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 3px;
        margin-top: 8px;
        margin-bottom: 32px;
      }
      
      /* Stats row */
      .stats-row {
        display: flex;
        gap: 16px;
        width: 100%;
        padding-top: 28px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .stat-item {
        flex: 1;
        text-align: center;
        padding: 16px 8px;
        border-radius: 16px;
      }
      
      .stat-correct {
        background: rgba(34, 197, 94, 0.08);
        border: 1px solid rgba(34, 197, 94, 0.15);
      }
      
      .stat-accuracy {
        background: rgba(251, 191, 36, 0.08);
        border: 1px solid rgba(251, 191, 36, 0.15);
      }
      
      .stat-streak {
        background: rgba(249, 115, 22, 0.08);
        border: 1px solid rgba(249, 115, 22, 0.15);
      }
      
      .stat-icon {
        font-size: 24px;
        margin-bottom: 8px;
      }
      
      .stat-item .stat-value {
        font-size: 24px;
        font-weight: 800;
        color: #ffffff;
        line-height: 1;
      }
      
      .stat-correct .stat-value {
        color: #22c55e;
      }
      
      .stat-accuracy .stat-value {
        color: var(--acc-color, #fbbf24);
      }
      
      .stat-streak .stat-value {
        color: #f97316;
      }
      
      .stat-item .stat-label {
        color: rgba(255, 255, 255, 0.5);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-top: 6px;
      }
      
      /* CTA section */
      .cta-section {
        margin-top: 32px;
        text-align: center;
      }
      
      .cta-challenge {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(236, 72, 153, 0.2) 100%);
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 20px;
        padding: 16px 32px;
        margin-bottom: 24px;
        color: rgba(255, 255, 255, 0.95);
        font-size: 18px;
        font-weight: 700;
      }
      
      .bot-link {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }
      
      .online-dot {
        width: 10px;
        height: 10px;
        background: #22c55e;
        border-radius: 50%;
        box-shadow: 0 0 12px #22c55e, 0 0 24px #22c55e;
      }
      
      .bot-link span {
        color: #a78bfa;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 1px;
      }
      
      /* Corners */
      .corner {
        position: absolute;
        width: 60px;
        height: 60px;
      }
      
      .corner.tl {
        top: 20px;
        left: 20px;
        border-left: 3px solid rgba(139, 92, 246, 0.5);
        border-top: 3px solid rgba(139, 92, 246, 0.5);
        border-top-left-radius: 16px;
      }
      
      .corner.tr {
        top: 20px;
        right: 20px;
        border-right: 3px solid rgba(139, 92, 246, 0.5);
        border-top: 3px solid rgba(139, 92, 246, 0.5);
        border-top-right-radius: 16px;
      }
      
      .corner.bl {
        bottom: 20px;
        left: 20px;
        border-left: 3px solid rgba(236, 72, 153, 0.5);
        border-bottom: 3px solid rgba(236, 72, 153, 0.5);
        border-bottom-left-radius: 16px;
      }
      
      .corner.br {
        bottom: 20px;
        right: 20px;
        border-right: 3px solid rgba(236, 72, 153, 0.5);
        border-bottom: 3px solid rgba(236, 72, 153, 0.5);
        border-bottom-right-radius: 16px;
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
