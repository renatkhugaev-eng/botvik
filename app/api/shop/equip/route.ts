import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/shop/equip — Надеть/снять рамку
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = auth.user.id;

  let body: { itemId: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { itemId } = body;

  // Если itemId = null, снимаем рамку
  if (itemId === null) {
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
  }

  // Проверяем что itemId — число
  if (typeof itemId !== "number") {
    return NextResponse.json({ error: "invalid_item_id" }, { status: 400 });
  }

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
}
