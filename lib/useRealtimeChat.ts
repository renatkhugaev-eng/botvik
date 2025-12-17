"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured, ChatMessagePayload, createChatChannel } from "./supabase";
import { api } from "./api";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Hook для работы с realtime чатом
 * 
 * Использует:
 * - Supabase Broadcast для мгновенных сообщений
 * - Supabase Presence для отслеживания онлайн-пользователей
 * - Polling fallback если Supabase не настроен
 */

type UseRealtimeChatOptions = {
  userId: number;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
};

type OnlineUser = {
  odId: number;
  odUsername: string | null;
  odFirstName: string | null;
  odPhotoUrl: string | null;
  online_at: string;
};

export function useRealtimeChat(options: UseRealtimeChatOptions) {
  const { userId, username, firstName, photoUrl } = options;
  
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ═══ Загрузка истории сообщений ═══
  const loadMessages = useCallback(async () => {
    try {
      const data = await api.get<{
        ok: boolean;
        messages?: ChatMessagePayload[];
        error?: string;
      }>("/api/chat?limit=50");
      
      if (data.ok && data.messages) {
        setMessages(data.messages);
        setError(null);
      } else {
        setError(data.error || "UNKNOWN_ERROR");
      }
    } catch (err) {
      console.error("[useRealtimeChat] Load error:", err);
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
      
      // Сразу добавляем сообщение локально (дубликаты отфильтруются в broadcast handler)
      if (data.message) {
        setMessages((prev) => {
          // Проверяем дубликаты
          if (prev.some((m) => m.id === data.message!.id)) return prev;
          return [...prev, data.message!];
        });
      }
      
      return { ok: true };
    } catch (err) {
      console.error("[useRealtimeChat] Send error:", err);
      return { ok: false, error: "NETWORK_ERROR" };
    }
  }, []);

  // ═══ Подписка на Supabase Realtime ═══
  useEffect(() => {
    // Загружаем историю
    loadMessages();

    if (!isSupabaseConfigured()) {
      console.log("[useRealtimeChat] Supabase not configured, using polling");
      // Fallback: polling every 3 seconds
      pollingIntervalRef.current = setInterval(loadMessages, 3000);
      return () => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      };
    }

    // Supabase Realtime
    const channel = createChatChannel(`user:${userId}`);
    channelRef.current = channel;

    channel
      // Слушаем новые сообщения
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        console.log("[useRealtimeChat] New message via broadcast:", payload);
        setMessages((prev) => {
          // Проверяем дубликаты
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload as ChatMessagePayload];
        });
      })
      // Слушаем присутствие
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const uniqueUsers = new Map<number, OnlineUser>();
        
        // Собираем уникальных пользователей по odId
        Object.values(state).forEach((presences: unknown[]) => {
          presences.forEach((p: unknown) => {
            const presence = p as OnlineUser;
            if (presence.odId && !uniqueUsers.has(presence.odId)) {
              uniqueUsers.set(presence.odId, presence);
            }
          });
        });
        
        const users = Array.from(uniqueUsers.values());
        console.log("[useRealtimeChat] Presence sync:", users.length, "unique users online", users.map(u => u.odFirstName || u.odUsername));
        setOnlineUsers(users);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        console.log("[useRealtimeChat] User joined:", newPresences);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        console.log("[useRealtimeChat] User left:", leftPresences);
      })
      .subscribe(async (status) => {
        console.log("[useRealtimeChat] Channel status:", status);
        
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          
          // Track our presence
          await channel.track({
            odId: userId,
            odUsername: username,
            odFirstName: firstName,
            odPhotoUrl: photoUrl,
            online_at: new Date().toISOString(),
          });
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setIsConnected(false);
        }
      });

    // Fallback polling каждые 5 секунд (на случай проблем с broadcast)
    pollingIntervalRef.current = setInterval(loadMessages, 5000);

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [userId, username, firstName, photoUrl, loadMessages]);

  // ═══ Scroll to bottom helper ═══
  const scrollToBottom = useCallback((container: HTMLElement | null) => {
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  return {
    messages,
    onlineUsers,
    onlineCount: Math.max(1, onlineUsers.length), // Минимум 1 (текущий пользователь)
    isConnected,
    isLoading,
    error,
    sendMessage,
    loadMessages,
    scrollToBottom,
  };
}
