/**
 * ═══════════════════════════════════════════════════════════════════════════
 * API: PANORAMA X-RAY HINT
 * Покупка платной подсказки "Рентген" за бонусную энергию
 * 
 * POST /api/panorama/hint/xray
 * - Списывает bonusEnergy
 * - Возвращает координаты ближайшей улики
 * - Логирует использование для аналитики
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const XRAY_COST = 0; // БЕСПЛАТНО (энергия не списывается)

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const XRayRequestSchema = z.object({
  /** ID миссии */
  missionId: z.string().min(1).max(100),
  /** ID улики, для которой нужна подсказка */
  clueId: z.string().min(1).max(100),
  /** Координаты улики [lat, lng] */
  clueCoordinates: z.tuple([z.number(), z.number()]).optional(),
  /** Название улики */
  clueName: z.string().max(200).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  // ═══ AUTHENTICATION ═══
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const userId = auth.user.id;

  // ═══ PARSE REQUEST ═══
  let body: z.infer<typeof XRayRequestSchema>;
  try {
    const json = await req.json();
    body = XRayRequestSchema.parse(json);
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Неверный формат запроса" },
      { status: 400 }
    );
  }

  // ═══ CHECK USER ENERGY ═══
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      bonusEnergy: true,
      bonusEnergyUsed: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "user_not_found" },
      { status: 404 }
    );
  }

  // ═══ DEDUCT ENERGY (если подсказка платная) ═══
  let remainingEnergy = user.bonusEnergy;
  
  if (XRAY_COST > 0) {
    if (user.bonusEnergy < XRAY_COST) {
      return NextResponse.json(
        { 
          error: "insufficient_energy",
          message: `Недостаточно энергии. Нужно ${XRAY_COST}, у вас ${user.bonusEnergy}`,
          required: XRAY_COST,
          available: user.bonusEnergy,
        },
        { status: 402 } // Payment Required
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        bonusEnergy: { decrement: XRAY_COST },
        bonusEnergyUsed: { increment: XRAY_COST },
      },
      select: {
        bonusEnergy: true,
      },
    });
    remainingEnergy = updatedUser.bonusEnergy;
  }

  // ═══ LOG HINT USAGE (for analytics) ═══
  console.log(`[panorama/hint/xray] User ${userId} used X-Ray hint for mission ${body.missionId}, clue ${body.clueId}. Cost: ${XRAY_COST}, Energy: ${user.bonusEnergy} → ${remainingEnergy}`);

  // ═══ RESPONSE ═══
  return NextResponse.json({
    ok: true,
    cost: XRAY_COST,
    remainingEnergy,
    xpPenalty: 0.2, // 20% штраф к XP
    message: XRAY_COST > 0 
      ? "Рентген активирован! XP за миссию уменьшен на 20%" 
      : "Рентген активирован! (бесплатно, XP -20%)",
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET HANDLER — Check if user can afford X-Ray
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  // ═══ AUTHENTICATION ═══
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      bonusEnergy: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "user_not_found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    cost: XRAY_COST,
    canAfford: user.bonusEnergy >= XRAY_COST,
    currentEnergy: user.bonusEnergy,
    xpPenalty: 0.2,
  });
}

