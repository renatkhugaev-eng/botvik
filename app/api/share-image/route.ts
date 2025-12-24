/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHARE IMAGE API — Generate high-quality Stories share image (1080x1920)
 * Best practices 2025: Authentication, rate limiting, Zod validation
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit, getClientIdentifier } from "@/lib/ratelimit";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { validate } from "@/lib/validation";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const HCTI_USER_ID = process.env.HCTI_USER_ID;
const HCTI_API_KEY = process.env.HCTI_API_KEY;

// Special rate limiter for expensive image generation (5 per minute)
const redis = Redis.fromEnv();
const imageGenerationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "ratelimit:share-image",
  analytics: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const ShareImageRequestSchema = z.object({
  quizTitle: z.string().max(100).default("True Crime Quiz"),
  score: z.number().int().min(0).default(0),
  correct: z.number().int().min(0).default(0),
  total: z.number().int().min(1).max(50).default(5),
  streak: z.number().int().min(0).default(0),
  stars: z.number().int().min(0).max(5).default(3),
  player: z.string().max(50).optional().default(""),
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/share-image — Generate share image
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  // ═══ AUTHENTICATION ═══
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // ═══ RATE LIMITING (strict for image generation) ═══
  const identifier = getClientIdentifier(request, auth.user.telegramId);
  const rateLimit = await checkRateLimit(imageGenerationLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  // ═══ VALIDATE CONFIGURATION ═══
  if (!HCTI_USER_ID || !HCTI_API_KEY) {
    return NextResponse.json(
      { error: "Image generation service not configured" },
      { status: 500 }
    );
  }

  // ═══ VALIDATE BODY ═══
  const body = await validate(request, ShareImageRequestSchema);
  if (!body.success) {
    return NextResponse.json(
      { error: body.error, details: body.details },
      { status: 400 }
    );
  }

  const { quizTitle, score, correct, total, streak, stars, player } = body.data;

  try {
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    // ═══ RANK INFO ═══
    const getRankInfo = (starCount: number) => {
      if (starCount >= 5) return { title: "ЛЕГЕНДА", color: "#FBBF24", emoji: "👑" };
      if (starCount >= 4) return { title: "МАСТЕР", color: "#A855F7", emoji: "⚡" };
      if (starCount >= 3) return { title: "ДЕТЕКТИВ", color: "#3B82F6", emoji: "🔍" };
      if (starCount >= 2) return { title: "АГЕНТ", color: "#22C55E", emoji: "🎯" };
      if (starCount >= 1) return { title: "НОВИЧОК", color: "#94A3B8", emoji: "🌟" };
      return { title: "ПОПРОБУЙ ЕЩЁ", color: "#64748B", emoji: "💪" };
    };

    const rank = getRankInfo(stars);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://botvik.app";

    // ═══ GENERATE HTML ═══
    const starsHTML = [1, 2, 3, 4, 5]
      .map(
        (i) =>
          `<img class="star ${i <= stars ? "filled" : "empty"}" src="${baseUrl}/icons/5.webp" alt="★">`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
  <div class="card">
    <div class="glow glow-top"></div>
    <div class="glow glow-center"></div>
    <div class="glow glow-bottom"></div>
    
    <div class="content">
      <div class="badge">
        <img class="badge-icon" src="${baseUrl}/icons/36.webp" alt="">
        <span class="badge-text">${escapeHtml(quizTitle)}</span>
      </div>
      
      ${player ? `<div class="player">${escapeHtml(player)}</div>` : ""}
      
      <div class="rank" style="--rank-color: ${rank.color}">
        <img class="rank-icon" src="${baseUrl}/icons/trophy.webp" alt="">
        <span class="rank-text">${rank.title}</span>
      </div>
      
      <div class="stars">${starsHTML}</div>
      
      <div class="score-card">
        <div class="score-label">МОЙ РЕЗУЛЬТАТ</div>
        <div class="score-value">${score.toLocaleString()}</div>
        <div class="score-unit">очков</div>
        
        <div class="stats">
          <div class="stat">
            <img class="stat-icon" src="${baseUrl}/icons/38.webp" alt="">
            <div class="stat-value" style="color: #22C55E">${correct}/${total}</div>
            <div class="stat-label">верных</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <img class="stat-icon" src="${baseUrl}/icons/medal.webp" alt="">
            <div class="stat-value" style="color: ${accuracy >= 70 ? "#22C55E" : accuracy >= 50 ? "#FBBF24" : "#EF4444"}">${accuracy}%</div>
            <div class="stat-label">точность</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <img class="stat-icon" src="${baseUrl}/icons/fire-medal.webp" alt="">
            <div class="stat-value" style="color: #F97316">${streak}</div>
            <div class="stat-label">серия</div>
          </div>
        </div>
      </div>
      
      <div class="cta">
        <img class="cta-icon" src="${baseUrl}/icons/49.webp" alt="">
        <div class="cta-text">Сможешь лучше? Проверь себя!</div>
      </div>
      
      <div class="bot-link">
        <span class="dot"></span>
        <span>@truecrimetg_bot</span>
      </div>
    </div>
    
    <div class="corner tl"></div>
    <div class="corner tr"></div>
    <div class="corner bl"></div>
    <div class="corner br"></div>
  </div>
</body>
</html>`;

    const css = generateCSS();

    // ═══ CALL HCTI API ═══
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
        google_fonts: "Manrope:400,500,600,700,800",
        viewport_width: 1080,
        viewport_height: 1920,
        device_scale: 1,
        full_page: true,
        transparent: false,
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

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateCSS(): string {
  return `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  width: 1080px;
  height: 1920px;
  background: #0A0A12;
  overflow: hidden;
}

.card {
  width: 1080px;
  height: 1920px;
  background: linear-gradient(180deg, #0A0A12 0%, #0F0A18 30%, #150D20 50%, #0F0A18 70%, #0A0A12 100%);
  position: relative;
  overflow: hidden;
  font-family: 'Manrope', -apple-system, sans-serif;
}

.glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.glow-top {
  width: 800px;
  height: 800px;
  left: 50%;
  top: -200px;
  transform: translateX(-50%);
  background: radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 60%);
}

.glow-center {
  width: 1000px;
  height: 1000px;
  left: 50%;
  top: 35%;
  transform: translateX(-50%);
  background: radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, transparent 50%);
}

.glow-bottom {
  width: 700px;
  height: 700px;
  right: -200px;
  bottom: 100px;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 60%);
}

.content {
  position: relative;
  z-index: 10;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 60px 80px;
}

.badge {
  display: flex;
  align-items: center;
  gap: 20px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.1) 100%);
  border: 2px solid rgba(139, 92, 246, 0.3);
  border-radius: 100px;
  padding: 24px 48px;
  margin-bottom: 40px;
}

.badge-icon {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.badge-text {
  color: #FFFFFF;
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 1px;
}

.player {
  color: rgba(255, 255, 255, 0.7);
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 30px;
}

.rank {
  display: flex;
  align-items: center;
  gap: 20px;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
  border: 3px solid var(--rank-color);
  border-radius: 24px;
  padding: 24px 60px;
  margin-bottom: 50px;
  box-shadow: 0 0 60px color-mix(in srgb, var(--rank-color) 40%, transparent);
}

.rank-icon {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.rank-text {
  color: var(--rank-color);
  font-size: 40px;
  font-weight: 800;
  letter-spacing: 8px;
  text-shadow: 0 0 30px color-mix(in srgb, var(--rank-color) 60%, transparent);
}

.stars {
  display: flex;
  gap: 20px;
  margin-bottom: 60px;
}

.star {
  width: 100px;
  height: 100px;
  object-fit: contain;
}

.star.filled {
  filter: drop-shadow(0 0 20px rgba(251, 191, 36, 0.8)) drop-shadow(0 0 40px rgba(251, 191, 36, 0.5));
}

.star.empty {
  opacity: 0.2;
  filter: grayscale(1);
}

.score-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 900px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 48px;
  padding: 60px 50px;
  box-shadow: 0 40px 100px rgba(0, 0, 0, 0.5);
}

.score-label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 6px;
  margin-bottom: 30px;
}

.score-value {
  font-size: 160px;
  font-weight: 800;
  background: linear-gradient(135deg, #FFFFFF 0%, #E9D5FF 50%, #F9A8D4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
  margin-bottom: 10px;
}

.score-unit {
  color: rgba(255, 255, 255, 0.4);
  font-size: 32px;
  font-weight: 600;
  letter-spacing: 4px;
  margin-bottom: 50px;
}

.stats {
  display: flex;
  align-items: center;
  gap: 40px;
  padding-top: 50px;
  border-top: 2px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  justify-content: center;
}

.stat {
  text-align: center;
  padding: 0 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-icon {
  width: 56px;
  height: 56px;
  object-fit: contain;
  margin-bottom: 12px;
}

.stat-value {
  font-size: 52px;
  font-weight: 800;
  line-height: 1.2;
}

.stat-label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 22px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-top: 10px;
}

.stat-divider {
  width: 2px;
  height: 80px;
  background: rgba(255, 255, 255, 0.1);
}

.cta {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 50px;
  margin-bottom: 40px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(236, 72, 153, 0.2) 100%);
  border: 2px solid rgba(139, 92, 246, 0.3);
  border-radius: 30px;
  padding: 30px 60px;
}

.cta-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.cta-text {
  color: rgba(255, 255, 255, 0.95);
  font-size: 32px;
  font-weight: 700;
}

.bot-link {
  display: flex;
  align-items: center;
  gap: 16px;
}

.dot {
  width: 16px;
  height: 16px;
  background: #22C55E;
  border-radius: 50%;
  box-shadow: 0 0 20px #22C55E, 0 0 40px #22C55E;
}

.bot-link span:last-child {
  color: #A78BFA;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 2px;
}

.corner {
  position: absolute;
  width: 100px;
  height: 100px;
}

.corner.tl {
  top: 40px;
  left: 40px;
  border-left: 4px solid rgba(139, 92, 246, 0.5);
  border-top: 4px solid rgba(139, 92, 246, 0.5);
  border-top-left-radius: 24px;
}

.corner.tr {
  top: 40px;
  right: 40px;
  border-right: 4px solid rgba(139, 92, 246, 0.5);
  border-top: 4px solid rgba(139, 92, 246, 0.5);
  border-top-right-radius: 24px;
}

.corner.bl {
  bottom: 40px;
  left: 40px;
  border-left: 4px solid rgba(236, 72, 153, 0.5);
  border-bottom: 4px solid rgba(236, 72, 153, 0.5);
  border-bottom-left-radius: 24px;
}

.corner.br {
  bottom: 40px;
  right: 40px;
  border-right: 4px solid rgba(236, 72, 153, 0.5);
  border-bottom: 4px solid rgba(236, 72, 153, 0.5);
  border-bottom-right-radius: 24px;
}
`;
}
