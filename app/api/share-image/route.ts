import { NextRequest, NextResponse } from "next/server";

/**
 * Generate beautiful share images using htmlcsstoimage.com
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
    
    // Generate stars HTML
    const starsHtml = [1, 2, 3, 4, 5]
      .map(
        (star) =>
          `<span style="font-size: 42px; ${
            star <= stars
              ? "filter: drop-shadow(0 0 12px rgba(251, 191, 36, 0.8));"
              : "opacity: 0.2; filter: grayscale(1);"
          }">⭐</span>`
      )
      .join("");

    // Beautiful HTML template
    const html = `
      <div class="card">
        <!-- Background effects -->
        <div class="glow glow-1"></div>
        <div class="glow glow-2"></div>
        <div class="glow glow-3"></div>
        
        <!-- Corner decorations -->
        <div class="corner corner-tl"></div>
        <div class="corner corner-tr"></div>
        <div class="corner corner-bl"></div>
        <div class="corner corner-br"></div>
        
        <!-- Crime tape -->
        <div class="tape tape-top">🔍 CRIME SCENE • DO NOT CROSS 🔍</div>
        
        <div class="content">
          <!-- Header -->
          <div class="quiz-badge">
            <span class="icon">🔍</span>
            <span class="title">${quizTitle}</span>
          </div>
          
          ${player ? `<p class="player">Детектив ${player}</p>` : ""}
          
          <!-- Stars -->
          <div class="stars">${starsHtml}</div>
          
          <!-- Score -->
          <div class="score-block">
            <p class="score-label">РЕЗУЛЬТАТ</p>
            <p class="score-value">${score.toLocaleString()}</p>
            <p class="score-unit">очков</p>
          </div>
          
          <!-- Stats -->
          <div class="stats">
            <div class="stat">
              <p class="stat-value">${correct}/${total}</p>
              <p class="stat-label">верных</p>
            </div>
            <div class="divider"></div>
            <div class="stat">
              <p class="stat-value accuracy">${accuracy}%</p>
              <p class="stat-label">точность</p>
            </div>
            <div class="divider"></div>
            <div class="stat">
              <p class="stat-value streak">🔥 ${streak}</p>
              <p class="stat-label">серия</p>
            </div>
          </div>
          
          ${rank > 0 ? `<div class="rank-badge">🏆 #${rank} в рейтинге</div>` : ""}
          
          <!-- Footer -->
          <div class="footer">
            <p class="cta">💀 Попробуй побить мой рекорд!</p>
            <div class="bot-badge">
              <span>✈️</span>
              <span>@truecrimetg_bot</span>
            </div>
          </div>
        </div>
        
        <div class="tape tape-bottom">🩸 INK & BLOOD QUIZ • 2024 🩸</div>
      </div>
    `;

    const css = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Inter', sans-serif;
      }
      
      .card {
        width: 600px;
        height: 800px;
        background: linear-gradient(135deg, #0f0f1a 0%, #1a1025 50%, #0a0a0f 100%);
        position: relative;
        overflow: hidden;
      }
      
      .glow {
        position: absolute;
        border-radius: 50%;
      }
      
      .glow-1 {
        left: -80px;
        top: -80px;
        width: 280px;
        height: 280px;
        background: radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, transparent 70%);
      }
      
      .glow-2 {
        right: -80px;
        bottom: -80px;
        width: 280px;
        height: 280px;
        background: radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, transparent 70%);
      }
      
      .glow-3 {
        left: 40%;
        top: 30%;
        width: 200px;
        height: 200px;
        background: radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%);
      }
      
      .corner {
        position: absolute;
        width: 40px;
        height: 40px;
      }
      
      .corner-tl {
        top: 20px;
        left: 20px;
        border-left: 3px solid rgba(139, 92, 246, 0.5);
        border-top: 3px solid rgba(139, 92, 246, 0.5);
        border-top-left-radius: 12px;
      }
      
      .corner-tr {
        top: 20px;
        right: 20px;
        border-right: 3px solid rgba(139, 92, 246, 0.5);
        border-top: 3px solid rgba(139, 92, 246, 0.5);
        border-top-right-radius: 12px;
      }
      
      .corner-bl {
        bottom: 20px;
        left: 20px;
        border-left: 3px solid rgba(236, 72, 153, 0.5);
        border-bottom: 3px solid rgba(236, 72, 153, 0.5);
        border-bottom-left-radius: 12px;
      }
      
      .corner-br {
        bottom: 20px;
        right: 20px;
        border-right: 3px solid rgba(236, 72, 153, 0.5);
        border-bottom: 3px solid rgba(236, 72, 153, 0.5);
        border-bottom-right-radius: 12px;
      }
      
      .tape {
        position: absolute;
        width: 140%;
        left: -20%;
        background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%);
        color: #000;
        font-weight: 700;
        font-size: 12px;
        text-align: center;
        padding: 6px 0;
        letter-spacing: 2px;
        z-index: 10;
      }
      
      .tape-top {
        top: 40px;
        transform: rotate(-3deg);
      }
      
      .tape-bottom {
        bottom: 30px;
        transform: rotate(2deg);
      }
      
      .content {
        position: relative;
        z-index: 5;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 80px 48px;
      }
      
      .quiz-badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50px;
        padding: 12px 24px;
        margin-bottom: 12px;
        backdrop-filter: blur(10px);
      }
      
      .quiz-badge .icon {
        font-size: 22px;
      }
      
      .quiz-badge .title {
        color: rgba(255, 255, 255, 0.95);
        font-weight: 600;
        font-size: 18px;
      }
      
      .player {
        color: rgba(255, 255, 255, 0.5);
        font-size: 16px;
        margin-bottom: 20px;
      }
      
      .stars {
        display: flex;
        gap: 12px;
        margin-bottom: 32px;
      }
      
      .score-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        border-radius: 28px;
        padding: 32px 56px;
        margin-bottom: 32px;
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%);
        border: 2px solid rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
      }
      
      .score-label {
        color: rgba(255, 255, 255, 0.5);
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 4px;
        margin-bottom: 8px;
      }
      
      .score-value {
        font-size: 72px;
        font-weight: 900;
        background: linear-gradient(135deg, #fff 0%, #c4b5fd 50%, #f9a8d4 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        line-height: 1;
        margin-bottom: 4px;
      }
      
      .score-unit {
        color: rgba(255, 255, 255, 0.5);
        font-size: 16px;
      }
      
      .stats {
        display: flex;
        gap: 36px;
        margin-bottom: 24px;
      }
      
      .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      
      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: #ffffff;
        margin-bottom: 4px;
      }
      
      .stat-value.accuracy {
        color: #34d399;
      }
      
      .stat-value.streak {
        color: #fbbf24;
      }
      
      .stat-label {
        color: rgba(255, 255, 255, 0.5);
        font-size: 13px;
      }
      
      .divider {
        width: 2px;
        height: 45px;
        background: rgba(255, 255, 255, 0.15);
      }
      
      .rank-badge {
        background: linear-gradient(135deg, rgba(251, 191, 36, 0.3) 0%, rgba(245, 158, 11, 0.3) 100%);
        border: 1px solid rgba(251, 191, 36, 0.4);
        border-radius: 50px;
        padding: 10px 24px;
        color: #fbbf24;
        font-weight: 600;
        font-size: 16px;
        margin-bottom: 24px;
      }
      
      .footer {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      
      .cta {
        color: rgba(255, 255, 255, 0.7);
        font-size: 16px;
        margin-bottom: 14px;
      }
      
      .bot-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(139, 92, 246, 0.35);
        border-radius: 50px;
        padding: 10px 22px;
        color: #c4b5fd;
        font-weight: 600;
        font-size: 16px;
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

