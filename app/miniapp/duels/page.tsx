/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUELS PAGE — Список дуэлей (входящие, исходящие, активные)
 * ══════════════════════════════════════════════════════════════════════════════
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMiniAppSession } from "@/app/miniapp/layout";
import { api } from "@/lib/api";
import { haptic } from "@/lib/haptic";
import { levelFromXp, getLevelTitle } from "@/lib/xp";

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

type DuelUser = {
  id: number;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
  xp: number;
};

type Duel = {
  id: string;
  status: string;
  challengerId: number;
  opponentId: number;
  challenger: DuelUser;
  opponent: DuelUser;
  quiz: { id: number; title: string };
  xpReward: number;
  createdAt: string;
  expiresAt: string;
};

type DuelsResponse = {
  ok: boolean;
  incoming: Duel[];
  outgoing: Duel[];
  active: Duel[];
};

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

export default function DuelsPage() {
  const session = useMiniAppSession();
  const router = useRouter();
  
  const [duels, setDuels] = useState<DuelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<"incoming" | "outgoing" | "active">("incoming");

  // Загрузка дуэлей
  const loadDuels = useCallback(async () => {
    try {
      const data = await api.get<DuelsResponse>("/api/duels");
      if (data.ok) {
        setDuels(data);
        // Автоматически переключаемся на таб с контентом
        if (data.incoming.length > 0) setTab("incoming");
        else if (data.active.length > 0) setTab("active");
        else if (data.outgoing.length > 0) setTab("outgoing");
      }
    } catch (error) {
      console.error("[Duels] Failed to load:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDuels();
  }, [loadDuels]);

  // Принять/Отклонить дуэль
  const handleDuelAction = async (duelId: string, action: "accept" | "decline" | "cancel") => {
    setActionLoading(duelId);
    haptic.medium();

    try {
      const result = await api.patch<{ ok: boolean; roomId?: string }>(`/api/duels/${duelId}`, {
        action,
      });

      if (result.ok) {
        haptic.success();
        
        if (action === "accept" && result.roomId) {
          // Переходим в комнату дуэли
          router.push(`/miniapp/duels/${duelId}`);
        } else {
          // Перезагружаем список
          loadDuels();
        }
      }
    } catch (error) {
      haptic.error();
      console.error("[Duels] Action failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  if (session.status !== "ready") return null;

  const userId = session.user.id;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f1a] to-[#1a1a2e] px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            haptic.light();
            router.back();
          }}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Дуэли</h1>
          <p className="text-sm text-white/50">Сражайся с друзьями 1 на 1</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "incoming", label: "Входящие", count: duels?.incoming.length || 0 },
          { key: "outgoing", label: "Исходящие", count: duels?.outgoing.length || 0 },
          { key: "active", label: "Активные", count: duels?.active.length || 0 },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => {
              haptic.light();
              setTab(key as typeof tab);
            }}
            className={`
              flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all
              ${tab === key
                ? "bg-violet-600 text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10"
              }
            `}
          >
            {label}
            {count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                tab === key ? "bg-white/20" : "bg-violet-500/30 text-violet-300"
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-violet-500" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {tab === "incoming" && (
              duels?.incoming.length === 0 ? (
                <EmptyState icon="📥" text="Нет входящих вызовов" />
              ) : (
                duels?.incoming.map((duel) => (
                  <DuelCard
                    key={duel.id}
                    duel={duel}
                    userId={userId}
                    type="incoming"
                    loading={actionLoading === duel.id}
                    onAccept={() => handleDuelAction(duel.id, "accept")}
                    onDecline={() => handleDuelAction(duel.id, "decline")}
                  />
                ))
              )
            )}

            {tab === "outgoing" && (
              duels?.outgoing.length === 0 ? (
                <EmptyState icon="📤" text="Нет исходящих вызовов" />
              ) : (
                duels?.outgoing.map((duel) => (
                  <DuelCard
                    key={duel.id}
                    duel={duel}
                    userId={userId}
                    type="outgoing"
                    loading={actionLoading === duel.id}
                    onCancel={() => handleDuelAction(duel.id, "cancel")}
                  />
                ))
              )
            )}

            {tab === "active" && (
              duels?.active.length === 0 ? (
                <EmptyState icon="⚔️" text="Нет активных дуэлей" />
              ) : (
                duels?.active.map((duel) => (
                  <DuelCard
                    key={duel.id}
                    duel={duel}
                    userId={userId}
                    type="active"
                    loading={false}
                    onJoin={() => router.push(`/miniapp/duels/${duel.id}`)}
                  />
                ))
              )
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* CTA: Вызвать друга */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={() => {
          haptic.medium();
          router.push("/miniapp/duels/challenge");
        }}
        className="fixed bottom-6 left-4 right-4 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-center shadow-lg"
        style={{ boxShadow: "0 0 30px rgba(139, 92, 246, 0.4)" }}
      >
        ⚔️ Вызвать друга на дуэль
      </motion.button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// КАРТОЧКА ДУЭЛИ
// ═══════════════════════════════════════════════════════════════════════════

function DuelCard({
  duel,
  userId,
  type,
  loading,
  onAccept,
  onDecline,
  onCancel,
  onJoin,
}: {
  duel: Duel;
  userId: number;
  type: "incoming" | "outgoing" | "active";
  loading: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  onJoin?: () => void;
}) {
  const isChallenger = duel.challengerId === userId;
  const other = isChallenger ? duel.opponent : duel.challenger;
  const otherLevel = levelFromXp(other.xp);
  const { icon: levelIcon } = getLevelTitle(otherLevel);

  // Время до истечения
  const expiresIn = new Date(duel.expiresAt).getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(expiresIn / (1000 * 60 * 60)));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/5 rounded-2xl p-4 border border-white/10"
    >
      <div className="flex items-center gap-3">
        {/* Аватар */}
        <div className="relative">
          {other.photoUrl ? (
            <img
              src={other.photoUrl}
              alt=""
              className="w-12 h-12 rounded-full object-cover ring-2 ring-violet-500/50"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
              {(other.firstName?.[0] || other.username?.[0] || "?").toUpperCase()}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 text-sm">{levelIcon}</span>
        </div>

        {/* Инфо */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate">
              {other.firstName || other.username || "Игрок"}
            </span>
            <span className="text-xs text-white/40">lvl {otherLevel}</span>
          </div>
          <div className="text-sm text-white/60 truncate">
            {duel.quiz.title}
          </div>
          {type !== "active" && hoursLeft > 0 && (
            <div className="text-xs text-amber-400/80 mt-1">
              ⏰ Истекает через {hoursLeft}ч
            </div>
          )}
        </div>

        {/* XP награда */}
        <div className="text-right">
          <div className="text-lg font-bold text-amber-400">+{duel.xpReward}</div>
          <div className="text-xs text-white/40">XP</div>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="flex gap-2 mt-4">
        {type === "incoming" && (
          <>
            <button
              onClick={onDecline}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-white/10 text-white/80 font-medium text-sm hover:bg-white/15 disabled:opacity-50"
            >
              Отклонить
            </button>
            <button
              onClick={onAccept}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-medium text-sm disabled:opacity-50"
            >
              {loading ? "..." : "Принять ⚔️"}
            </button>
          </>
        )}

        {type === "outgoing" && (
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-white/10 text-white/80 font-medium text-sm hover:bg-white/15 disabled:opacity-50"
          >
            {loading ? "..." : "Отменить"}
          </button>
        )}

        {type === "active" && (
          <button
            onClick={onJoin}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm"
          >
            Войти в дуэль ⚔️
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ПУСТОЕ СОСТОЯНИЕ
// ═══════════════════════════════════════════════════════════════════════════

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-white/50">{text}</div>
    </div>
  );
}
