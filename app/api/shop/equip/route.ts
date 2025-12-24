import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit, shopEquipLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { z } from "zod";
import { parseAndValidate } from "@/lib/validation";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const EquipRequestSchema = z.object({
  itemId: z.number().int().positive().nullable(),
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/shop/equip — Надеть/снять рамку
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = auth.user.id;

  // Rate limiting
  const identifier = getClientIdentifier(req, auth.user.telegramId);
  const rateLimit = await checkRateLimit(shopEquipLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  // ═══ ZOD VALIDATION ═══
  const validation = await parseAndValidate(req, EquipRequestSchema);
  if (!validation.success) {
    return validation.response;
  }
  
  const { itemId } = validation.data;

  // Если itemId = null, снимаем рамку
  if (itemId === null) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { equippedFrameId: null },
      });

      console.log(`[shop/equip] User ${userId} unequipped frame`);

      return NextResponse.json({
        ok: true,
        equipped: null,
        message: "Рамка снята",
      });
    } catch (error) {
      console.error("[shop/equip] Failed to unequip:", error);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
  }

  // itemId уже валидирован Zod как positive int

  // Проверяем владение товаром
  const ownership = await prisma.userInventory.findUnique({
    where: {
      userId_itemId: { userId, itemId },
    },
    include: {
      item: true,
    },
  });

  if (!ownership) {
    return NextResponse.json({ error: "item_not_owned" }, { status: 403 });
  }

  // Проверяем что это рамка
  if (ownership.item.type !== "FRAME") {
    return NextResponse.json({ error: "not_a_frame" }, { status: 400 });
  }

  // Надеваем рамку
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { equippedFrameId: itemId },
    });

    console.log(`[shop/equip] User ${userId} equipped frame ${itemId}`);

    return NextResponse.json({
      ok: true,
      equipped: {
        id: ownership.item.id,
        slug: ownership.item.slug,
        title: ownership.item.title,
        imageUrl: ownership.item.imageUrl,
      },
      message: `Рамка "${ownership.item.title}" надета!`,
    });
  } catch (error) {
    console.error("[shop/equip] Failed to equip:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
