/**
 * Тестирование всех типов уведомлений
 * 
 * Использование:
 *   npx tsx scripts/test-all-notifications.ts <telegramId>
 * 
 * Пример:
 *   npx tsx scripts/test-all-notifications.ts 123456789
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Загружаем .env и .env.local вручную
const envPath = path.resolve(process.cwd(), ".env");
const envLocalPath = path.resolve(process.cwd(), ".env.local");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

// Telegram Bot API
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface NotificationTest {
  id: string;
  name: string;
  message: string;
}

const TEST_NOTIFICATIONS: NotificationTest[] = [
  {
    id: "level_up",
    name: "Level Up",
    message: `
🎉 *[ТЕСТ] Поздравляем!*

Ты достиг *уровня 10*!
🏅 Новый титул: Детектив

+150 XP за последний квиз

[▶️ Продолжить играть](https://t.me/truecrimetg_bot/app)
    `.trim(),
  },
  {
    id: "energy_full",
    name: "Energy Full",
    message: `
⚡ *[ТЕСТ] Энергия полностью восстановлена!*

У тебя 5/5 энергии — полный заряд! 🔋
Самое время разгадать пару загадок 🕵️

[▶️ Начать игру](https://t.me/truecrimetg_bot/app)
    `.trim(),
  },
  {
    id: "daily_reminder",
    name: "Daily Reminder",
    message: `
👋 *[ТЕСТ] Привет, детектив!*

Ты ещё не играл сегодня. Не упусти ежедневный бонус *+30 XP*!

🔥 Твой уровень: 5
📊 Очков: 1000

[▶️ Играть](https://t.me/truecrimetg_bot/app)
    `.trim(),
  },
  {
    id: "leaderboard_change",
    name: "Leaderboard Change",
    message: `
🏆 *[ТЕСТ] Изменение в рейтинге!*

Ты поднялся на *#3* место! 📈

Игрок TestPlayer набрал 500 очков.

[▶️ Вернуть позицию](https://t.me/truecrimetg_bot/app)
    `.trim(),
  },
  {
    id: "weekly_winner",
    name: "Weekly Winner",
    message: `
🏆 *[ТЕСТ] Поздравляем!*

Ты занял *🥇 1-е место* в еженедельном соревновании!

📊 Твой результат: *1500* очков
🎮 Сыграно игр: 10
⭐ Лучший результат: 500

🎁 +100 XP бонус!

Новая неделя — новые возможности! 🚀

[▶️ Играть](https://t.me/truecrimetg_bot/app)
    `.trim(),
  },
  {
    id: "duel_challenge",
    name: "Duel Challenge",
    message: `
⚔️ *[ТЕСТ] Вызов на дуэль!*

TestChallenger вызывает тебя на дуэль!

🎯 Квиз: *Тестовый квиз*
🏆 Награда: *+50 XP* победителю

⏰ Вызов действует 24 часа

[▶️ Принять вызов](https://t.me/truecrimetg_bot/app?startapp=duel_test123)
    `.trim(),
  },
  {
    id: "duel_result",
    name: "Duel Result",
    message: `
🎉 *[ТЕСТ] Победа в дуэли!*

Ты победил TestOpponent! ⚔️

📊 Счёт: *500 : 400*
🏆 Получено: *+50 XP*

[▶️ Ещё дуэль](https://t.me/truecrimetg_bot/app?startapp=duels)
    `.trim(),
  },
  {
    id: "tournament_winner",
    name: "Tournament Winner",
    message: `
🏆 *[ТЕСТ] Поздравляем, чемпион!*

Ты занял *🥇 1-е место* в турнире *"Тестовый турнир"*!

📊 Твой результат: *2000* очков
🎁 Награда: *+500 XP*
🏅 Приз: *Золотая рамка*

Ты лучший из *100* участников! 🔥

[▶️ Смотреть результаты](https://t.me/truecrimetg_bot/app?startapp=tournament_test)
    `.trim(),
  },
  {
    id: "tournament_finished",
    name: "Tournament Finished",
    message: `
🏁 *[ТЕСТ] Турнир завершён!*

Турнир *"Тестовый турнир"* подошёл к концу.

📊 Твой результат: *1500* очков
🏆 Твоё место: *#5* из 100
✅ Пройдено этапов: 3/3

👏 Отличный результат! Ты в топ-10!

[▶️ Смотреть результаты](https://t.me/truecrimetg_bot/app?startapp=tournament_test)
    `.trim(),
  },
  {
    id: "tournament_starting",
    name: "Tournament Starting",
    message: `
⚔️ *[ТЕСТ] Турнир начинается!*

Турнир *"Новый турнир"* стартует через 30 минут!

✅ Ты уже зарегистрирован — не пропусти старт!

👥 Участников: 50
🏆 Призы: 500 XP + уникальная рамка

[▶️ Перейти к турниру](https://t.me/truecrimetg_bot/app?startapp=tournament_new)
    `.trim(),
  },
];

async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
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
      console.error(`   ❌ Telegram error:`, result.description);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`   ❌ Send error:`, error);
    return false;
  }
}

async function main() {
  const telegramId = process.argv[2];

  if (!telegramId) {
    console.log("❌ Укажи Telegram ID:");
    console.log("   npx tsx scripts/test-all-notifications.ts <telegramId>");
    console.log("\n   Пример: npx tsx scripts/test-all-notifications.ts 123456789");
    process.exit(1);
  }

  if (!BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN не настроен в .env.local");
    process.exit(1);
  }

  console.log("\n🔔 Тестирование всех типов уведомлений");
  console.log("═".repeat(50));
  console.log(`📱 Telegram ID: ${telegramId}`);
  console.log(`📊 Всего типов: ${TEST_NOTIFICATIONS.length}`);
  console.log(`🤖 Bot Token: ${BOT_TOKEN?.slice(0, 10)}...`);
  console.log("═".repeat(50));

  console.log("\n🚀 Отправляю тестовые уведомления...\n");

  let successCount = 0;
  let failCount = 0;

  for (const notification of TEST_NOTIFICATIONS) {
    process.stdout.write(`   ${notification.name}... `);
    
    const success = await sendTelegramMessage(telegramId, notification.message);
    
    if (success) {
      console.log("✅");
      successCount++;
    } else {
      console.log("❌");
      failCount++;
    }

    // Задержка между сообщениями (Telegram rate limit)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("\n" + "═".repeat(50));
  console.log(`📊 Результат: ${successCount}/${TEST_NOTIFICATIONS.length} отправлено`);
  
  if (failCount > 0) {
    console.log(`\n⚠️  ${failCount} уведомлений не доставлено!`);
    console.log("   Возможные причины:");
    console.log("   - Пользователь заблокировал бота");
    console.log("   - Неверный Telegram ID");
    console.log("   - Проблемы с Telegram API");
  } else {
    console.log("\n🎉 Все уведомления успешно отправлены!");
    console.log("   Проверь Telegram — должно прийти 10 сообщений.");
  }
}

main().catch(console.error);

