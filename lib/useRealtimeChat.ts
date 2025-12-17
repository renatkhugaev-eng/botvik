"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  supabase, 
  isSupabaseConfigured, 
  ChatMessagePayload, 
  PresenceUser,
  createChatChannel,
  supabaseLog as log,
  isDev,
} from "./supabase";
import { api } from "./api";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Оптимизированный hook для realtime чата
 * 
 * Улучшения v2:
 * - Client→Client broadcast (без серверного посредника)
 * - Умный polling (только при проблемах с realtime)
 * - Инкрементальная загрузка (только новые сообщения)
 * - Retry/reconnect логика
 * - Production-safe логирование
 */

type UseRealtimeChatOptions = {
  userId: number;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
};

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const INITIAL_LOAD_LIMIT = 50;
const INCREMENTAL_LOAD_LIMIT = 20;
const SMART_POLL_INTERVAL = 10000; // 10 сек — только как fallback
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useRealtimeChat(options: UseRealtimeChatOptions) {
  const { userId, username, firstName, photoUrl } = options;
  
  // State
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const newestMessageIdRef = useRef<number | null>(null);
  const realtimeWorkingRef = useRef(false); // Флаг что realtime работает

  // ═══ Загрузка сообщений ═══
  const loadMessages = useCallback(async (mode: "initial" | "incremental" = "initial") => {
    try {
      const limit = mode === "initial" ? INITIAL_LOAD_LIMIT : INCREMENTAL_LOAD_LIMIT;
      const afterParam = mode === "incremental" && newestMessageIdRef.current 
        ? `&after=${newestMessageIdRef.current}` 
        : "";
      
      const data = await api.get<{
        ok: boolean;
        messages?: ChatMessagePayload[];
        newestId?: number | null;
        error?: string;
      }>(`/api/chat?limit=${limit}${afterParam}`);
      
      if (data.ok && data.messages) {
        if (mode === "initial") {
          setMessages(data.messages);
        } else if (data.messages.length > 0) {
          // Инкрементальное добавление новых
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMessages = data.messages!.filter((m) => !existingIds.has(m.id));
            return newMessages.length > 0 ? [...prev, ...newMessages] : prev;
          });
        }
        
        // Обновляем newest ID
        if (data.newestId) {
          newestMessageIdRef.current = data.newestId;
        } else if (data.messages.length > 0) {
          newestMessageIdRef.current = Math.max(...data.messages.map((m) => m.id));
        }
        
        setError(null);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      if (isDev) console.error("[useRealtimeChat] Load error:", err);
      setError("NETWORK_ERROR");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ═══ Отправка сообщения ═══
  const sendMessage = useCallback(async (text: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const data = await api.post<{
        ok: boolean;
        message?: ChatMessagePayload;
        error?: string;
      }>("/api/chat", { text });
      
      if (!data.ok) {
        return { ok: false, error: data.error };
      }
      
      if (data.message) {
        // Оптимистичное добавление
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message!.id)) return prev;
          return [...prev, data.message!];
        });
        
        // Обновляем newest ID
        newestMessageIdRef.current = data.message.id;
        
        // Broadcast через Supabase (client→client)
        if (channelRef.current && realtimeWorkingRef.current) {
          try {
            await channelRef.current.send({
              type: "broadcast",
              event: "message",
              payload: data.message,
            });
            log("Broadcast sent:", data.message.id);
          } catch (broadcastErr) {
            // Не критично — другие получат через polling
            if (isDev) console.warn("[useRealtimeChat] Broadcast failed:", broadcastErr);
          }
        }
      }
      
      return { ok: true };
    } catch (err) {
      if (isDev) console.error("[useRealtimeChat] Send error:", err);
      return { ok: false, error: "NETWORK_ERROR" };
    }
  }, []);

  // ═══ Умный polling ═══
  const startSmartPolling = useCallback(() => {
    // Останавливаем если уже есть
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Polling только если realtime не работает
    pollingIntervalRef.current = setInterval(() => {
      if (!realtimeWorkingRef.current) {
        log("Smart poll (realtime not working)");
        loadMessages("incremental");
      }
    }, SMART_POLL_INTERVAL);
  }, [loadMessages]);

  // ═══ Подключение к Supabase ═══
  const connect = useCallback(() => {
    if (!isSupabaseConfigured()) {
      log("Supabase not configured, using polling only");
      setConnectionState("disconnected");
      pollingIntervalRef.current = setInterval(() => loadMessages("incremental"), 3000);
      return;
    }

    setConnectionState("connecting");
    
    // Создаём канал
    const channel = createChatChannel(`user:${userId}`);
    channelRef.current = channel;

    channel
      // Слушаем сообщения от других
      .on("broadcast", { event: "message" }, ({ payload }) => {
        log("Received broadcast:", payload?.id);
        realtimeWorkingRef.current = true; // Realtime работает!
        
        const msg = payload as ChatMessagePayload;
        if (msg && msg.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          
          // Обновляем newest ID
          if (!newestMessageIdRef.current || msg.id > newestMessageIdRef.current) {
            newestMessageIdRef.current = msg.id;
          }
        }
      })
      // Presence sync
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const uniqueUsers = new Map<number, PresenceUser>();
        
        Object.values(state).forEach((presences: unknown[]) => {
          presences.forEach((p: unknown) => {
            const presence = p as PresenceUser;
            if (presence.odId && !uniqueUsers.has(presence.odId)) {
              uniqueUsers.set(presence.odId, presence);
            }
          });
        });
        
        const users = Array.from(uniqueUsers.values());
        log("Presence sync:", users.length, "users");
        setOnlineUsers(users);
      })
      // Подписка
      .subscribe(async (status) => {
        log("Channel status:", status);
        
        if (status === "SUBSCRIBED") {
          setConnectionState("connected");
          reconnectAttemptRef.current = 0; // Reset reconnect counter
          
          // Track presence
          await channel.track({
            odId: userId,
            odUsername: username,
            odFirstName: firstName,
            odPhotoUrl: photoUrl,
            online_at: new Date().toISOString(),
          });
          
          // Инкрементальная загрузка при подключении
          loadMessages("incremental");
          
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setConnectionState("error");
          realtimeWorkingRef.current = false;
          
          // Reconnect с exponential backoff
          const attempt = reconnectAttemptRef.current;
          const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
          
          log(`Reconnecting in ${delay}ms (attempt ${attempt + 1})`);
          reconnectAttemptRef.current++;
          
          setTimeout(() => {
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
            }
            connect();
          }, delay);
        }
      });
      
    // Запускаем умный polling
    startSmartPolling();
    
  }, [userId, username, firstName, photoUrl, loadMessages, startSmartPolling]);

  // ═══ Lifecycle ═══
  useEffect(() => {
    // Initial load
    loadMessages("initial");
    
    // Connect to realtime
    connect();

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [connect, loadMessages]);

  // ═══ Scroll helper ═══
  const scrollToBottom = useCallback((container: HTMLElement | null) => {
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // ═══ Return ═══
  return {
    messages,
    onlineUsers,
    onlineCount: Math.max(1, onlineUsers.length),
    isConnected: connectionState === "connected",
    connectionState,
    isLoading,
    error,
    sendMessage,
    loadMessages: () => loadMessages("incremental"),
    scrollToBottom,
  };
}
