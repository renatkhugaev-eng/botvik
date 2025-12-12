import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Канал для проверки подписки (без @)
const REQUIRED_CHANNEL = "dark_bookshelf";

type ChatMemberStatus = "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";

type TelegramResponse = {
  ok: boolean;
  result?: {
    status: ChatMemberStatus;
  };
  description?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { telegramUserId } = await req.json();

    // В dev режиме пропускаем проверку подписки
    const allowDevMock = process.env.NEXT_PUBLIC_ALLOW_DEV_NO_TELEGRAM === "true";
    if (allowDevMock && process.env.NODE_ENV !== "production") {
      console.log("[check-subscription] DEV MODE - skipping subscription check");
      return NextResponse.json({ subscribed: true, status: "dev-mock", channel: REQUIRED_CHANNEL });
    }

    if (!telegramUserId) {
      return NextResponse.json({ subscribed: false, error: "NO_USER_ID" }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error("[check-subscription] NO_BOT_TOKEN");
      // В dev без токена тоже пропускаем
      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({ subscribed: true, status: "no-token-dev", channel: REQUIRED_CHANNEL });
      }
      return NextResponse.json({ subscribed: false, error: "SERVER_ERROR" }, { status: 500 });
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=@${REQUIRED_CHANNEL}&user_id=${telegramUserId}`
    );

    const data = (await response.json()) as TelegramResponse;
    console.log("[check-subscription]", { telegramUserId, channel: REQUIRED_CHANNEL, response: data });

    if (data.ok && data.result) {
      const status = data.result.status;
      const isSubscribed = ["creator", "administrator", "member"].includes(status);
      
      return NextResponse.json({ 
        subscribed: isSubscribed, 
        status,
        channel: REQUIRED_CHANNEL,
      });
    }

    // Ошибка от Telegram API (бот не админ в канале, канал не найден и т.д.)
    return NextResponse.json({ 
      subscribed: false, 
      error: data.description ?? "TELEGRAM_API_ERROR",
      channel: REQUIRED_CHANNEL,
    });

  } catch (error) {
    console.error("[check-subscription] Error:", error);
    return NextResponse.json({ subscribed: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

