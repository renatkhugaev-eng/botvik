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
  const messagesRef = useRef<ChatMessagePayload[]>([]); // Для синхронного доступа к messages
  const pendingReactionsRef = useRef<Set<number>>(new Set()); // Защита от двойных кликов
  
  // Синхронизируем ref с state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
          // Инкрементальное добавление новых + обновление реакций на существующих
          setMessages((prev) => {
            const result = [...prev];
            let hasChanges = false;
            
            for (const newMsg of data.messages!) {
              const existingIdx = result.findIndex(m => m.id === newMsg.id);
              if (existingIdx === -1) {
                // Новое сообщение — добавляем
                result.push(newMsg);
                hasChanges = true;
              } else {
                // Существующее — обновляем реакции если изменились
                const existing = result[existingIdx];
                const reactionsChanged = JSON.stringify(existing.reactions) !== JSON.stringify(newMsg.reactions);
                if (reactionsChanged) {
                  result[existingIdx] = {
                    ...existing,
                    reactions: newMsg.reactions,
                    // Сохраняем myReaction из локального state если есть
                    myReaction: newMsg.myReaction,
                  };
                  hasChanges = true;
                }
              }
            }
            
            return hasChanges ? result : prev;
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

  // ═══ Добавление/удаление реакции ═══
  const toggleReaction = useCallback(async (
    messageId: number, 
    emoji: string
  ): Promise<{ ok: boolean; error?: string }> => {
    // ═══ ЗАЩИТА ОТ ДВОЙНЫХ КЛИКОВ ═══
    if (pendingReactionsRef.current.has(messageId)) {
      return { ok: false, error: "PENDING" };
    }
    pendingReactionsRef.current.add(messageId);
    
    try {
      // Синхронно читаем текущее состояние через ref
      const currentMessage = messagesRef.current.find(m => m.id === messageId);
      if (!currentMessage) {
        pendingReactionsRef.current.delete(messageId);
        return { ok: false, error: "MESSAGE_NOT_FOUND" };
      }
      
      const previousReaction = currentMessage.myReaction;
      const previousReactions = { ...(currentMessage.reactions || {}) };
      const isRemoving = previousReaction === emoji;
      
      // ═══ ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ ═══
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        
        const newReactions = { ...(m.reactions || {}) };
        
        if (isRemoving) {
          // Удаляем свою реакцию
          if (newReactions[emoji]) {
            newReactions[emoji]--;
            if (newReactions[emoji] <= 0) {
              delete newReactions[emoji];
            }
          }
          return {
            ...m,
            reactions: Object.keys(newReactions).length > 0 ? newReactions : undefined,
            myReaction: null,
          };
        } else {
          // Убираем предыдущую реакцию если была
          if (m.myReaction && newReactions[m.myReaction]) {
            newReactions[m.myReaction]--;
            if (newReactions[m.myReaction] <= 0) {
              delete newReactions[m.myReaction];
            }
          }
          // Добавляем новую
          newReactions[emoji] = (newReactions[emoji] || 0) + 1;
          return {
            ...m,
            reactions: newReactions,
            myReaction: emoji,
          };
        }
      }));
      
      // ═══ ЗАПРОС К СЕРВЕРУ ═══
      let data: { ok: boolean; reactionCounts?: Record<string, number>; error?: string };
      
      if (isRemoving) {
        data = await api.delete<typeof data>(`/api/chat/reactions?messageId=${messageId}`);
      } else {
        data = await api.post<typeof data>("/api/chat/reactions", { messageId, emoji });
      }
      
      if (data.ok) {
        // Синхронизируем с серверным состоянием
        setMessages(prev => prev.map(m => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            reactions: data.reactionCounts && Object.keys(data.reactionCounts).length > 0 
              ? data.reactionCounts 
              : undefined,
            myReaction: isRemoving ? null : emoji,
          };
        }));
        
        // Broadcast reaction update
        if (channelRef.current && realtimeWorkingRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "reaction",
            payload: { messageId, reactions: data.reactionCounts, userId },
          }).catch(() => {});
        }
      } else {
        // ═══ ОТКАТ: восстанавливаем предыдущее состояние ═══
        setMessages(prev => prev.map(m => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            reactions: Object.keys(previousReactions).length > 0 ? previousReactions : undefined,
            myReaction: previousReaction || null,
          };
        }));
      }
      
      return { ok: data.ok, error: data.error };
    } catch (err) {
      if (isDev) console.error("[useRealtimeChat] Reaction error:", err);
      return { ok: false, error: "NETWORK_ERROR" };
    } finally {
      // Снимаем блокировку
      pendingReactionsRef.current.delete(messageId);
    }
  }, [userId]);

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

  // ═══ Fallback на polling (для iOS и при ошибках) ═══
  const startPollingFallback = useCallback(() => {
    log("Starting polling fallback");
    setConnectionState("disconnected");
    if (!pollingIntervalRef.current) {
      pollingIntervalRef.current = setInterval(() => loadMessages("incremental"), 3000);
    }
  }, [loadMessages]);

  // ═══ Подключение к Supabase ═══
  const connect = useCallback(() => {
    // Оборачиваем ВСЁ в try-catch для защиты от краша на iOS
    try {
      if (!isSupabaseConfigured()) {
        log("Supabase not configured, using polling only");
        startPollingFallback();
        return;
      }

      // Проверяем поддержку WebSocket (iOS Safari иногда блокирует)
      if (typeof WebSocket === "undefined") {
        console.warn("[useRealtimeChat] WebSocket not supported, using polling");
        startPollingFallback();
        return;
      }

      setConnectionState("connecting");
      
      // Создаём канал с обработкой ошибок
      let channel;
      try {
        channel = createChatChannel(`user:${userId}`);
        channelRef.current = channel;
      } catch (error) {
        console.error("[useRealtimeChat] Failed to create channel:", error);
        startPollingFallback();
        return;
      }

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
      // Слушаем реакции от других
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        log("Received reaction broadcast:", payload?.messageId);
        realtimeWorkingRef.current = true;
        
        const { messageId, reactions, userId: reactorId } = payload as { 
          messageId: number; 
          reactions: Record<string, number>; 
          userId: number;
        };
        
        if (messageId && reactorId !== userId) { // Не обновляем свои реакции
          setMessages((prev) => prev.map(m => {
            if (m.id !== messageId) return m;
            return {
              ...m,
              reactions: reactions && Object.keys(reactions).length > 0 ? reactions : undefined,
            };
          }));
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
      
    } catch (error) {
      // Критическая ошибка — fallback на polling
      console.error("[useRealtimeChat] Critical error in connect:", error);
      startPollingFallback();
    }
  }, [userId, username, firstName, photoUrl, loadMessages, startSmartPolling, startPollingFallback]);

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
    toggleReaction,
    loadMessages: () => loadMessages("incremental"),
    scrollToBottom,
  };
}
