/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DUELS PAGE — True Crime Style
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

  const loadDuels = useCallback(async () => {
    try {
      const data = await api.get<DuelsResponse>("/api/duels");
      if (data.ok) {
        setDuels(data);
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
          router.push(`/miniapp/duels/${duelId}`);
        } else {
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
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Background texture */}
      <div 
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Red ambient glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-950/15 rounded-full blur-[120px]" />
      </div>

      {/* Vignette */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)]" />

      {/* Content */}
      <div className="relative z-10 px-4 py-6 pb-36">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => {
              haptic.light();
              router.back();
            }}
            className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Дуэли</h1>
            <p className="text-sm text-zinc-500">Допросы 1 на 1</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
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
                flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2
                ${tab === key
                  ? "bg-red-900 text-white shadow-lg"
                  : "text-zinc-500 hover:text-zinc-300"
                }
              `}
            >
              {label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  tab === key ? "bg-white/20" : "bg-red-900/50 text-red-400"
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-red-600 animate-spin" />
            </div>
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
                  <EmptyState icon="📥" title="Нет вызовов" text="Входящие вызовы на дуэль появятся здесь" />
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
                  <EmptyState icon="📤" title="Нет вызовов" text="Твои исходящие вызовы появятся здесь" />
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
                  <EmptyState icon="⚔️" title="Нет активных" text="Активные дуэли появятся здесь" />
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
      </div>

      {/* CTA Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
        <div className="flex gap-3">
          {/* Quick Game - поиск любого соперника */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            onClick={() => {
              haptic.medium();
              router.push("/miniapp/duels/quick");
            }}
            className="flex-1 py-4 rounded-xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold text-center shadow-xl shadow-red-900/30 transition-all"
          >
            ⚡ Быстрая игра
          </motion.button>
          
          {/* Challenge Friend */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => {
              haptic.medium();
              router.push("/miniapp/duels/challenge");
            }}
            className="flex-1 py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-center shadow-xl shadow-zinc-900/30 transition-all border border-zinc-700"
          >
            👥 Вызов друга
          </motion.button>
        </div>
      </div>
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

  const expiresIn = new Date(duel.expiresAt).getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(expiresIn / (1000 * 60 * 60)));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-xl p-4 border border-zinc-800 shadow-lg"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {other.photoUrl ? (
            <img
              src={other.photoUrl}
              alt=""
              className="w-14 h-14 rounded-full object-cover ring-2 ring-red-900/50"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-xl ring-2 ring-red-900/50">
              {(other.firstName?.[0] || other.username?.[0] || "?").toUpperCase()}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 text-base bg-zinc-900 rounded-full p-0.5">{levelIcon}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate">
              {other.firstName || other.username || "Подозреваемый"}
            </span>
            <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
              lvl {otherLevel}
            </span>
          </div>
          <div className="text-sm text-zinc-500 truncate mt-0.5">
            📁 {duel.quiz.title}
          </div>
          {type !== "active" && hoursLeft > 0 && (
            <div className="text-xs text-amber-500/80 mt-1 flex items-center gap-1">
              <span>⏱</span>
              <span>Истекает через {hoursLeft}ч</span>
            </div>
          )}
        </div>

        {/* XP Reward */}
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-bold text-emerald-400">+{duel.xpReward}</div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider">XP</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        {type === "incoming" && (
          <>
            <button
              onClick={onDecline}
              disabled={loading}
              className="flex-1 py-3 rounded-lg bg-zinc-800 text-zinc-300 font-medium text-sm hover:bg-zinc-700 disabled:opacity-50 transition-colors border border-zinc-700"
            >
              Отклонить
            </button>
            <button
              onClick={onAccept}
              disabled={loading}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-medium text-sm disabled:opacity-50 transition-all shadow-lg shadow-emerald-900/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </span>
              ) : (
                "Принять ⚔️"
              )}
            </button>
          </>
        )}

        {type === "outgoing" && (
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 rounded-lg bg-zinc-800 text-zinc-300 font-medium text-sm hover:bg-zinc-700 disabled:opacity-50 transition-colors border border-zinc-700"
          >
            {loading ? "..." : "Отменить вызов"}
          </button>
        )}

        {type === "active" && (
          <button
            onClick={onJoin}
            className="flex-1 py-3 rounded-lg bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold text-sm transition-all shadow-lg shadow-red-900/30"
          >
            Войти в допрос ⚔️
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ПУСТОЕ СОСТОЯНИЕ
// ═══════════════════════════════════════════════════════════════════════════

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16"
    >
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
        <span className="text-3xl">{icon}</span>
      </div>
      <h3 className="text-white font-medium mb-1">{title}</h3>
      <p className="text-zinc-600 text-sm">{text}</p>
    </motion.div>
  );
}
