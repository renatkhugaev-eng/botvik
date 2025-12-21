/**
 * Тест отправки уведомления
 * Запуск: npx ts-node scripts/test-notification.ts <userId>
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTelegramMessage(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  }

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
    
    if (!result.ok) {
      return { 
        ok: false, 
        error: `Telegram API error: ${result.error_code} - ${result.description}` 
      };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function main() {
  const userId = parseInt(process.argv[2] || "197");
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`📬 ТЕСТ УВЕДОМЛЕНИЙ USER ${userId}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Check bot token
  console.log("🔑 BOT TOKEN:", BOT_TOKEN ? `${BOT_TOKEN.slice(0, 10)}...` : "❌ НЕ УСТАНОВЛЕН");
  
  if (!BOT_TOKEN) {
    console.log("\n❌ TELEGRAM_BOT_TOKEN не настроен в .env");
    return;
  }

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      id: true, 
      telegramId: true,
      firstName: true,
      username: true,
      xp: true,
    },
  });

  if (!user) {
    console.log("❌ Пользователь не найден!");
    return;
  }

  console.log("👤 Пользователь:", user.firstName ?? user.username);
  console.log("📱 Telegram ID:", user.telegramId);
  console.log("");

  // Calculate level
  const level = Math.max(1, Math.floor((-1 + Math.sqrt(1 + (4 * user.xp) / 50)) / 2));

  // Send test notification
  console.log("📤 Отправляем тестовое уведомление...\n");

  const testMessage = `
🧪 *Тестовое уведомление*

Это проверка системы уведомлений.

📊 Твой уровень: *${level}*
⚡ XP: ${user.xp}

Если ты видишь это сообщение — уведомления работают! ✅

[▶️ Открыть игру](https://t.me/truecrimetg_bot/app)
  `.trim();

  const result = await sendTelegramMessage(user.telegramId, testMessage);

  if (result.ok) {
    console.log("✅ УВЕДОМЛЕНИЕ ОТПРАВЛЕНО УСПЕШНО!");
    
    // Update lastNotifiedAt
    await prisma.user.update({
      where: { id: userId },
      data: { lastNotifiedAt: new Date() },
    });
    console.log("   lastNotifiedAt обновлён");
  } else {
    console.log("❌ ОШИБКА ОТПРАВКИ:");
    console.log(`   ${result.error}`);
    
    if (result.error?.includes("403")) {
      console.log("\n⚠️  Пользователь заблокировал бота!");
      console.log("   Нужно разблокировать @truecrimetg_bot в Telegram.");
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
