import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { createInvoiceLink, createPayload } from "@/lib/telegram-payments";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/shop/purchase — Создать платёж для покупки товара
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = auth.user.id;

  let body: { itemId: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { itemId } = body;
  if (!itemId || typeof itemId !== "number") {
    return NextResponse.json({ error: "item_id_required" }, { status: 400 });
  }

  // Получаем товар
  const item = await prisma.cosmeticItem.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    return NextResponse.json({ error: "item_not_found" }, { status: 404 });
  }

  if (!item.isActive) {
    return NextResponse.json({ error: "item_not_available" }, { status: 400 });
  }

  // Проверяем, что пользователь ещё не владеет этим товаром
  const existingOwnership = await prisma.userInventory.findUnique({
    where: {
      userId_itemId: { userId, itemId },
    },
  });

  if (existingOwnership) {
    return NextResponse.json({ error: "already_owned" }, { status: 400 });
  }

  // Создаём запись о покупке со статусом PENDING
  const purchase = await prisma.purchase.create({
    data: {
      userId,
      itemId,
      telegramPaymentId: `pending_${Date.now()}_${userId}_${itemId}`,
      amountStars: item.priceStars,
      status: "PENDING",
    },
  });

  // Создаём payload для Telegram
  const payload = createPayload({
    userId,
    itemId,
    purchaseId: purchase.id,
  });

  // Создаём ссылку на оплату через Telegram Stars
  const invoiceResponse = await createInvoiceLink({
    title: item.title,
    description: item.description || `Рамка для аватарки: ${item.title}`,
    payload,
    currency: "XTR",
    prices: [{ label: item.title, amount: item.priceStars }],
    photo_url: item.previewUrl || undefined,
    photo_width: 200,
    photo_height: 200,
  });

  if (!invoiceResponse.ok || !invoiceResponse.result) {
    // Удаляем pending покупку при ошибке
    await prisma.purchase.delete({ where: { id: purchase.id } });
    
    console.error("[shop/purchase] Failed to create invoice:", invoiceResponse);
    return NextResponse.json(
      { error: "payment_creation_failed", details: invoiceResponse.description },
      { status: 500 }
    );
  }

  console.log(`[shop/purchase] Created invoice for user ${userId}, item ${itemId}, purchase ${purchase.id}`);

  return NextResponse.json({
    ok: true,
    invoiceUrl: invoiceResponse.result,
    purchaseId: purchase.id,
  });
}
