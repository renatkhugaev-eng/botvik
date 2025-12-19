/**
 * Скрипт для настройки Telegram Webhook
 * 
 * Использование:
 *   npx tsx scripts/setup-telegram-webhook.ts
 *   npx tsx scripts/setup-telegram-webhook.ts --delete  (удалить webhook)
 *   npx tsx scripts/setup-telegram-webhook.ts --info    (информация о текущем webhook)
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Загружаем .env и .env.local (как Next.js)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL; // e.g., https://your-app.vercel.app/api/telegram/webhook
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN не установлен в .env");
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ═══════════════════════════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════════════════════════

async function getWebhookInfo() {
  const res = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
  return res.json();
}

async function setWebhook(url: string, secretToken?: string) {
  const body: Record<string, unknown> = {
    url,
    allowed_updates: ["message", "pre_checkout_query"], // Только нужные апдейты
    drop_pending_updates: true, // Очистить очередь старых апдейтов
  };

  if (secretToken) {
    body.secret_token = secretToken;
  }

  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return res.json();
}

async function deleteWebhook() {
  const res = await fetch(`${TELEGRAM_API}/deleteWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drop_pending_updates: true }),
  });

  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  
  console.log("🤖 Telegram Webhook Manager\n");

  // --info: Показать текущий webhook
  if (args.includes("--info")) {
    console.log("📡 Получаем информацию о webhook...\n");
    const info = await getWebhookInfo();
    
    if (info.ok) {
      const result = info.result;
      console.log("  URL:", result.url || "(не установлен)");
      console.log("  Has custom certificate:", result.has_custom_certificate);
      console.log("  Pending update count:", result.pending_update_count);
      console.log("  Last error date:", result.last_error_date 
        ? new Date(result.last_error_date * 1000).toISOString() 
        : "(нет ошибок)");
      console.log("  Last error message:", result.last_error_message || "(нет)");
      console.log("  Max connections:", result.max_connections);
      console.log("  Allowed updates:", result.allowed_updates?.join(", ") || "(все)");
    } else {
      console.error("❌ Ошибка:", info.description);
    }
    return;
  }

  // --delete: Удалить webhook
  if (args.includes("--delete")) {
    console.log("🗑️  Удаляем webhook...\n");
    const result = await deleteWebhook();
    
    if (result.ok) {
      console.log("✅ Webhook успешно удалён");
    } else {
      console.error("❌ Ошибка:", result.description);
    }
    return;
  }

  // Установить webhook
  if (!WEBHOOK_URL) {
    console.error("❌ TELEGRAM_WEBHOOK_URL не установлен в .env");
    console.log("\nПример:");
    console.log("  TELEGRAM_WEBHOOK_URL=https://your-app.vercel.app/api/telegram/webhook");
    process.exit(1);
  }

  console.log("🔗 Устанавливаем webhook...\n");
  console.log("  URL:", WEBHOOK_URL);
  console.log("  Secret token:", WEBHOOK_SECRET ? "✅ настроен" : "⚠️ не настроен (рекомендуется)");
  console.log();

  const result = await setWebhook(WEBHOOK_URL, WEBHOOK_SECRET || undefined);

  if (result.ok) {
    console.log("✅ Webhook успешно установлен!\n");
    
    // Показать текущее состояние
    const info = await getWebhookInfo();
    if (info.ok && info.result.url) {
      console.log("📡 Текущий webhook:", info.result.url);
    }
  } else {
    console.error("❌ Ошибка:", result.description);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ Критическая ошибка:", e);
  process.exit(1);
});
