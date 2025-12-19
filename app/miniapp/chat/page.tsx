"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useMiniAppSession } from "../layout";
import { useRealtimeChat } from "@/lib/useRealtimeChat";
import { haptic } from "@/lib/haptic";
import { isSupabaseConfigured } from "@/lib/supabase";
import { AvatarWithFrame } from "@/components/AvatarWithFrame";

/**
 * Глобальный чат для всех пользователей
 * 
 * Features:
 * - Realtime сообщения через Supabase Broadcast
 * - Presence: кто онлайн
 * - Автоскролл к новым сообщениям
 * - Rate limiting на сервере
 */

export default function ChatPage() {
  const router = useRouter();
  const session = useMiniAppSession();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Проверяем авторизацию
  if (session.status !== "ready") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-violet-500" />
      </div>
    );
  }

  const { user } = session;

  return <ChatContent user={user} />;
}

type ChatContentProps = {
  user: {
    id: number;
    username: string | null;
    firstName: string | null;
    photoUrl: string | null;
  };
};

function ChatContent({ user }: ChatContentProps) {
  const router = useRouter();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const {
    messages,
    onlineCount,
    isConnected,
    isLoading,
    error,
    sendMessage,
    scrollToBottom,
  } = useRealtimeChat({
    userId: user.id,
    username: user.username,
    firstName: user.firstName,
    photoUrl: user.photoUrl,
  });

  // Автоскролл при новых сообщениях
  useEffect(() => {
    scrollToBottom(messagesContainerRef.current);
  }, [messages, scrollToBottom]);

  // Фокус на input при загрузке
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Отправка сообщения
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setSendError(null);
    haptic.light();

    const result = await sendMessage(text);

    if (result.ok) {
      setInputText("");
      inputRef.current?.focus();
    } else {
      setSendError(result.error || "Ошибка отправки");
      haptic.error();
    }

    setIsSending(false);
  }, [inputText, isSending, sendMessage]);

  // Отправка по Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)]">
      {/* ═══ HEADER ═══ */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between py-3 shrink-0"
      >
        <button
          onClick={() => {
            haptic.light();
            router.back();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/5 active:scale-95 transition-transform"
          aria-label="Назад"
        >
          <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        
        <div className="flex items-center gap-2 rounded-full bg-[#0a0a0f] px-4 py-2 shadow-lg">
          <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-yellow-500"} animate-pulse`} />
          <span className="text-[14px] font-semibold text-white/90">💬 Общий чат</span>
        </div>
        
        {/* Online count */}
        <div className="flex h-11 min-w-11 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/5 px-3">
          <span className="text-[12px] font-bold text-green-600">🟢 {onlineCount}</span>
        </div>
      </motion.header>

      {/* ═══ MESSAGES ═══ */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto scrollbar-hide py-4 space-y-3"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-violet-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="text-4xl mb-2">😔</span>
            <p className="text-slate-500 text-sm">Ошибка загрузки чата</p>
            <p className="text-slate-400 text-xs mt-1">{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="text-6xl mb-4">💬</span>
            <p className="text-slate-600 font-semibold">Чат пуст</p>
            <p className="text-slate-400 text-sm mt-1">Будь первым, напиши сообщение!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, index) => {
              const isOwn = msg.odId === user.id;
              const showAvatar = index === 0 || messages[index - 1].odId !== msg.odId;
              
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex gap-2 max-w-[85%] ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Avatar — кликабельный для перехода в профиль */}
                    {showAvatar && (
                      <button
                        onClick={() => {
                          haptic.light();
                          router.push(`/miniapp/profile?userId=${msg.odId}`);
                        }}
                        className="shrink-0 mt-auto active:scale-95 transition-transform"
                        aria-label={`Профиль ${msg.firstName || msg.username || "игрока"}`}
                      >
                        <AvatarWithFrame
                          photoUrl={msg.photoUrl}
                          frameUrl={msg.frameUrl}
                          size={32}
                          fallbackLetter={(msg.firstName || msg.username || "?")[0].toUpperCase()}
                          className=""
                        />
                      </button>
                    )}
                    {!showAvatar && <div className="w-8 shrink-0" />}
                    
                    {/* Message bubble */}
                    <div
                      className={`rounded-2xl px-4 py-2.5 ${
                        isOwn
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-md"
                          : "bg-white shadow-md text-slate-800 rounded-bl-md"
                      }`}
                    >
                      {/* Username with level (only for others) */}
                      {!isOwn && showAvatar && (
                        <p className="text-[11px] font-semibold text-violet-600 mb-0.5 flex items-center gap-1">
                          <span>{msg.firstName || msg.username || "Игрок"}</span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 text-[9px] font-bold text-violet-700">
                            {msg.levelIcon} {msg.level}
                          </span>
                        </p>
                      )}
                      
                      {/* Text */}
                      <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">
                        {msg.text}
                      </p>
                      
                      {/* Time and level */}
                      <p className={`text-[10px] mt-1 flex items-center gap-1.5 ${isOwn ? "text-white/60" : "text-slate-400"}`}>
                        <span>{formatTime(msg.createdAt)}</span>
                        {isOwn && (
                          <span className="opacity-70">{msg.levelIcon} Lv.{msg.level}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ═══ INPUT ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="shrink-0 py-3"
      >
        {/* Error message */}
        <AnimatePresence>
          {sendError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl"
            >
              <p className="text-[12px] text-red-600">{sendError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input row */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Написать сообщение..."
              maxLength={500}
              disabled={isSending}
              className="w-full h-12 px-4 pr-12 rounded-2xl bg-white shadow-lg shadow-black/5 text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
            />
            {/* Character count */}
            {inputText.length > 400 && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                {inputText.length}/500
              </span>
            )}
          </div>
          
          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isSending}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all ${
              inputText.trim() && !isSending
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 active:scale-95"
                : "bg-slate-200 text-slate-400"
            }`}
            aria-label="Отправить"
          >
            {isSending ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>

        {/* Supabase status (dev only) */}
        {process.env.NODE_ENV === "development" && (
          <p className="text-[10px] text-slate-400 text-center mt-2">
            {isSupabaseConfigured() ? "🟢 Supabase Realtime" : "🟡 Polling mode (3s)"}
          </p>
        )}
      </motion.div>
    </div>
  );
}
