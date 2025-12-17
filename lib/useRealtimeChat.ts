"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured, ChatMessagePayload, createChatChannel } from "./supabase";
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
      const res = await fetch("/api/chat?limit=50");
      const data = await res.json();
      
      if (data.ok) {
        setMessages(data.messages);
        setError(null);
      } else {
        setError(data.error);
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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      
      const data = await res.json();
      
      if (!data.ok) {
        return { ok: false, error: data.error || data.message };
      }
      
      // Сообщение придёт через broadcast, но если нет Supabase — добавляем вручную
      if (!isSupabaseConfigured()) {
        setMessages((prev) => [...prev, data.message]);
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
    const channel = createChatChannel();
    channelRef.current = channel;

    channel
      // Слушаем новые сообщения
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        console.log("[useRealtimeChat] New message:", payload);
        setMessages((prev) => {
          // Проверяем дубликаты
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload as ChatMessagePayload];
        });
      })
      // Слушаем присутствие
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: OnlineUser[] = [];
        
        Object.values(state).forEach((presences: any[]) => {
          presences.forEach((p) => {
            if (p.odId) users.push(p);
          });
        });
        
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
    onlineCount: onlineUsers.length,
    isConnected,
    isLoading,
    error,
    sendMessage,
    loadMessages,
    scrollToBottom,
  };
}
