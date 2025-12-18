import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/shop — Список товаров магазина
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  // Попытка аутентификации (необязательно)
  const auth = await authenticateRequest(req);
  const userId = auth.ok ? auth.user.id : null;

  // Получаем все активные товары
  let items;
  try {
    items = await prisma.cosmeticItem.findMany({
      where: { isActive: true },
      orderBy: [
        { priceStars: "desc" },
        { createdAt: "desc" },
      ],
    });
  } catch (error) {
    console.error("[shop] Failed to fetch items:", error);
    return NextResponse.json({ ok: false, error: "db_error", items: [], equippedFrameId: null }, { status: 500 });
  }

  // Если пользователь авторизован, добавляем информацию о владении
  if (userId) {
    const [inventory, user] = await Promise.all([
      prisma.userInventory.findMany({
        where: { userId },
        select: { itemId: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { equippedFrameId: true },
      }),
    ]);

    const ownedItemIds = new Set(inventory.map((i) => i.itemId));
    const equippedFrameId = user?.equippedFrameId;

    const itemsWithOwnership = items.map((item) => ({
      ...item,
      owned: ownedItemIds.has(item.id),
      equipped: item.id === equippedFrameId,
    }));

    return NextResponse.json({
      ok: true,
      items: itemsWithOwnership,
      equippedFrameId,
    });
  }

  // Без авторизации — просто список товаров
  return NextResponse.json({
    ok: true,
    items: items.map((item) => ({
      ...item,
      owned: false,
      equipped: false,
    })),
    equippedFrameId: null,
  });
}
