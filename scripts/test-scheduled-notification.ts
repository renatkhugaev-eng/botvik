/**
 * Тест системы запланированных уведомлений
 * Запуск: npx ts-node scripts/test-scheduled-notification.ts <userId>
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    const result = await response.json();
    return result.ok;
  } catch {
    return false;
  }
}

async function main() {
  const userId = parseInt(process.argv[2] || "197");
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`🧪 ТЕСТ ЗАПЛАНИРОВАННЫХ УВЕДОМЛЕНИЙ`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Проверяем что таблица существует
  console.log("1️⃣ Проверка таблицы ScheduledNotification...");
  try {
    const count = await prisma.scheduledNotification.count();
    console.log(`   ✅ Таблица существует! Записей: ${count}\n`);
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error}`);
    console.log("   Запусти: npx prisma db push\n");
    return;
  }

  // 2. Получаем пользователя
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, telegramId: true, firstName: true, notifyEnergyFull: true },
  });

  if (!user) {
    console.log("❌ Пользователь не найден!");
    return;
  }

  console.log("2️⃣ Пользователь:");
  console.log(`   ID: ${user.id}`);
  console.log(`   Имя: ${user.firstName}`);
  console.log(`   notifyEnergyFull: ${user.notifyEnergyFull ? "✅" : "❌"}\n`);

  // 3. Создаём тестовое уведомление (на сейчас)
  console.log("3️⃣ Создаём запланированное уведомление на СЕЙЧАС...");
  
  const now = new Date();
  const scheduled = await prisma.scheduledNotification.create({
    data: {
      userId: user.id,
      type: "ENERGY_RESTORED",
      scheduledAt: now, // Сейчас
      data: { energy: 1, test: true },
    },
  });
  console.log(`   ✅ Создано! ID: ${scheduled.id}, scheduledAt: ${scheduled.scheduledAt.toISOString()}\n`);

  // 4. Обрабатываем уведомление (симулируем cron)
  console.log("4️⃣ Обрабатываем уведомление (симуляция cron)...");
  
  const pending = await prisma.scheduledNotification.findFirst({
    where: { id: scheduled.id, sentAt: null },
  });

  if (!pending) {
    console.log("   ❌ Уведомление не найдено!\n");
    return;
  }

  // Отправляем уведомление
  const message = `
⚡ *Энергия восстановлена!*

У тебя снова 1/5 энергии.
Время играть! 🎮

_(Это тестовое уведомление)_

[▶️ Начать игру](https://t.me/truecrimetg_bot/app)
  `.trim();

  const success = await sendTelegramMessage(user.telegramId, message);

  if (success) {
    // Помечаем как отправленное
    await prisma.scheduledNotification.update({
      where: { id: scheduled.id },
      data: { sentAt: new Date() },
    });
    console.log("   ✅ УВЕДОМЛЕНИЕ ОТПРАВЛЕНО!\n");
  } else {
    console.log("   ❌ Не удалось отправить уведомление\n");
  }

  // 5. Показываем статистику
  console.log("5️⃣ Статистика:");
  const stats = await prisma.scheduledNotification.groupBy({
    by: ["type"],
    _count: true,
  });
  
  for (const stat of stats) {
    console.log(`   ${stat.type}: ${stat._count} записей`);
  }

  const pendingCount = await prisma.scheduledNotification.count({
    where: { sentAt: null },
  });
  console.log(`   Ожидают отправки: ${pendingCount}\n`);

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("✅ ТЕСТ ЗАВЕРШЁН!");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
