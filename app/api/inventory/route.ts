import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/inventory — Получить инвентарь пользователя
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = auth.user.id;

  // Получаем все предметы из инвентаря пользователя
  const inventory = await prisma.userInventory.findMany({
    where: { userId },
    include: {
      item: {
        select: {
          id: true,
          slug: true,
          type: true,
          title: true,
          description: true,
          imageUrl: true,
          rarity: true,
        },
      },
    },
    orderBy: { acquiredAt: "desc" },
  });

  // Получаем текущую экипированную рамку
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { equippedFrameId: true },
  });

  const equippedFrameId = user?.equippedFrameId ?? null;

  // Группируем по типу
  const items = inventory.map((inv) => ({
    id: inv.item.id,
    slug: inv.item.slug,
    type: inv.item.type,
    title: inv.item.title,
    description: inv.item.description,
    imageUrl: inv.item.imageUrl,
    rarity: inv.item.rarity,
    acquiredAt: inv.acquiredAt.toISOString(),
    equipped: inv.item.id === equippedFrameId,
  }));

  // Статистика
  const stats = {
    total: items.length,
    frames: items.filter((i) => i.type === "FRAME").length,
    equipped: equippedFrameId,
  };

  return NextResponse.json({
    ok: true,
    items,
    stats,
    equippedFrameId,
  });
}
