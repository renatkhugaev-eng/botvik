import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  answerPreCheckoutQuery,
  parsePayload,
  sendPaymentConfirmation,
  isValidTelegramRequest,
  type TelegramUpdate,
} from "@/lib/telegram-payments";

export const runtime = "nodejs";

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || null;

// Предупреждение если secret не настроен в production
if (!WEBHOOK_SECRET && process.env.NODE_ENV === "production") {
  console.error("[telegram/webhook] ❌ CRITICAL: TELEGRAM_WEBHOOK_SECRET не настроен в production!");
  // В production без секрета webhook должен быть отключен
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/telegram/webhook — Обработка вебхуков от Telegram
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  // Проверяем подпись (ОБЯЗАТЕЛЬНО в production)
  const headerToken = req.headers.get("x-telegram-bot-api-secret-token");
  
  // В production требуем наличие секрета
  if (process.env.NODE_ENV === "production" && !WEBHOOK_SECRET) {
    console.error("[telegram/webhook] CRITICAL: Webhook secret not configured in production");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  
  if (!isValidTelegramRequest(WEBHOOK_SECRET, headerToken)) {
    console.error("[telegram/webhook] Invalid secret token");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  console.log("[telegram/webhook] Received update:", JSON.stringify(update, null, 2));

  // ═══════════════════════════════════════════════════════════════════════════
  // Pre-checkout query — подтверждение перед оплатой
  // Нужно ответить в течение 10 секунд!
  // ═══════════════════════════════════════════════════════════════════════════
  if (update.pre_checkout_query) {
    const query = update.pre_checkout_query;
    const payload = parsePayload(query.invoice_payload);

    if (!payload) {
      await answerPreCheckoutQuery(query.id, false, "Ошибка обработки платежа");
      return NextResponse.json({ ok: true });
    }

    // Проверяем что покупка существует и в статусе PENDING
    const purchase = await prisma.purchase.findUnique({
      where: { id: payload.purchaseId },
      include: { item: true },
    });

    if (!purchase) {
      await answerPreCheckoutQuery(query.id, false, "Покупка не найдена");
      return NextResponse.json({ ok: true });
    }

    if (purchase.status !== "PENDING") {
      await answerPreCheckoutQuery(query.id, false, "Покупка уже обработана");
      return NextResponse.json({ ok: true });
    }

    // Проверяем что товар ещё активен
    if (!purchase.item.isActive) {
      await answerPreCheckoutQuery(query.id, false, "Товар больше не доступен");
      return NextResponse.json({ ok: true });
    }

    // Проверяем что сумма совпадает с ценой товара (защита от манипуляций)
    if (query.total_amount !== purchase.item.priceStars) {
      console.error(`[telegram/webhook] Price mismatch: expected ${purchase.item.priceStars}, got ${query.total_amount}`);
      await answerPreCheckoutQuery(query.id, false, "Неверная сумма платежа");
      return NextResponse.json({ ok: true });
    }

    // Проверяем что пользователь ещё не владеет товаром
    const existingOwnership = await prisma.userInventory.findUnique({
      where: {
        userId_itemId: {
          userId: payload.userId,
          itemId: payload.itemId,
        },
      },
    });

    if (existingOwnership) {
      await answerPreCheckoutQuery(query.id, false, "Вы уже владеете этим товаром");
      return NextResponse.json({ ok: true });
    }

    // Всё ок — подтверждаем платёж
    await answerPreCheckoutQuery(query.id, true);
    console.log(`[telegram/webhook] Pre-checkout approved for purchase ${payload.purchaseId}`);

    return NextResponse.json({ ok: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Successful payment — платёж прошёл успешно
  // ═══════════════════════════════════════════════════════════════════════════
  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment;
    const telegramUserId = update.message.from.id;
    const payload = parsePayload(payment.invoice_payload);

    if (!payload) {
      console.error("[telegram/webhook] Failed to parse successful payment payload");
      return NextResponse.json({ ok: true });
    }

    console.log(`[telegram/webhook] Successful payment: user=${payload.userId}, item=${payload.itemId}, purchase=${payload.purchaseId}`);

    try {
      // Атомарная транзакция: обновляем покупку + добавляем в инвентарь
      await prisma.$transaction(async (tx) => {
        // 1. Обновляем статус покупки
        await tx.purchase.update({
          where: { id: payload.purchaseId },
          data: {
            status: "COMPLETED",
            telegramPaymentId: payment.telegram_payment_charge_id,
            completedAt: new Date(),
          },
        });

        // 2. Добавляем товар в инвентарь (upsert на случай race condition)
        await tx.userInventory.upsert({
          where: {
            userId_itemId: {
              userId: payload.userId,
              itemId: payload.itemId,
            },
          },
          create: {
            userId: payload.userId,
            itemId: payload.itemId,
          },
          update: {}, // Если уже есть — ничего не делаем
        });
      });

      // Получаем название товара для уведомления
      const item = await prisma.cosmeticItem.findUnique({
        where: { id: payload.itemId },
        select: { title: true },
      });

      // Отправляем подтверждение пользователю
      if (item) {
        await sendPaymentConfirmation(telegramUserId, item.title);
      }

      console.log(`[telegram/webhook] Purchase ${payload.purchaseId} completed successfully`);

    } catch (error) {
      console.error("[telegram/webhook] Failed to process successful payment:", error);
      // Не возвращаем ошибку Telegram — платёж уже прошёл
    }

    return NextResponse.json({ ok: true });
  }

  // Другие типы апдейтов (пока игнорируем)
  return NextResponse.json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/telegram/webhook — Проверка работоспособности
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Telegram webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
