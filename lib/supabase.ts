import { createClient, RealtimeChannel } from "@supabase/supabase-js";

/**
 * Supabase client для Realtime функционала (чат, presence)
 * 
 * Мы используем Supabase ТОЛЬКО для Realtime, БД остаётся на Prisma/Neon
 * 
 * Документация: https://supabase.com/docs/guides/realtime
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    realtime: {
      params: {
        eventsPerSecond: 10, // Rate limiting
      },
    },
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// CHAT CHANNEL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export type ChatMessagePayload = {
  id: number;
  userId: number;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
  text: string;
  createdAt: string;
};

export type PresenceUser = {
  odId: number;
  odUsername: string | null;
  odFirstName: string | null;
  odPhotoUrl: string | null;
  online_at: string;
};

/**
 * Создаёт канал для глобального чата
 * Naming convention: scope:id:entity
 */
export function createChatChannel(): RealtimeChannel {
  return supabase.channel("global:chat:messages", {
    config: {
      broadcast: { self: true }, // Получать свои сообщения тоже
      presence: { key: "" }, // Будет установлен при track()
    },
  });
}

/**
 * Проверяет готовность Supabase клиента
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== "https://placeholder.supabase.co");
}
