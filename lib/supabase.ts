import { createClient, RealtimeChannel } from "@supabase/supabase-js";

/**
 * Supabase client для Realtime функционала (чат, presence)
 * 
 * Мы используем Supabase ТОЛЬКО для Realtime, БД остаётся на Prisma/Neon
 * 
 * Архитектура:
 * - Client → Client broadcast (без серверного посредника)
 * - Presence для отслеживания онлайн пользователей
 * - Fallback polling для надёжности
 * 
 * Документация: https://supabase.com/docs/guides/realtime
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Логируем только в dev
const isDev = process.env.NODE_ENV === "development";
const log = (...args: unknown[]) => isDev && console.log("[Supabase]", ...args);
const warn = (...args: unknown[]) => console.warn("[Supabase]", ...args);

if (!supabaseUrl || !supabaseAnonKey) {
  warn("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Безопасное создание клиента с обработкой ошибок
let supabaseClient: ReturnType<typeof createClient>;

try {
  supabaseClient = createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-key",
    {
      realtime: {
        params: {
          eventsPerSecond: 10, // Rate limiting на клиенте
        },
      },
    }
  );
} catch (error) {
  warn("Failed to create Supabase client:", error);
  // Создаём dummy клиент который не будет падать
  supabaseClient = createClient(
    "https://placeholder.supabase.co",
    "placeholder-key"
  );
}

export const supabase = supabaseClient;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ChatMessagePayload = {
  id: number;
  odId: number; // Переименовано для консистентности с presence
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
  frameUrl: string | null; // URL рамки из магазина
  level: number;
  levelIcon: string;
  text: string;
  createdAt: string;
  // Реакции: { "❤️": 3, "🔥": 1 }
  reactions?: Record<string, number>;
  // Моя реакция на это сообщение (если есть)
  myReaction?: string | null;
};

export type PresenceUser = {
  odId: number;
  odUsername: string | null;
  odFirstName: string | null;
  odPhotoUrl: string | null;
  online_at: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL FACTORY
// ═══════════════════════════════════════════════════════════════════════════

const CHAT_CHANNEL_NAME = "global:chat:v2";

/**
 * Создаёт канал для глобального чата
 * @param presenceKey - уникальный ключ для presence (user:${odId})
 */
export function createChatChannel(presenceKey: string): RealtimeChannel {
  log("Creating channel with presence key:", presenceKey);
  
  return supabase.channel(CHAT_CHANNEL_NAME, {
    config: {
      broadcast: { self: false }, // Не получать свои сообщения
      presence: { key: presenceKey },
    },
  });
}

/**
 * Проверяет готовность Supabase клиента
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl !== "https://placeholder.supabase.co"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS FOR LOGGING
// ═══════════════════════════════════════════════════════════════════════════

export { log as supabaseLog, isDev };
