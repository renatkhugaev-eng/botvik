"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMiniAppSession } from "../layout";
import { haptic } from "@/lib/haptic";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SkeletonProfilePage, SkeletonFriendCard } from "@/components/Skeleton";

type SummaryResponse = {
  user: {
    id: number;
    telegramId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  stats: {
    totalSessions: number;
    totalQuizzesPlayed: number;
    totalCorrectAnswers: number;
    totalScore: number;
    bestScoreByQuiz: { quizId: number; title: string; bestScore: number }[];
    lastSession: { quizId: number; quizTitle: string; score: number; finishedAt: string | Date } | null;
  };
};

type Friend = {
  friendshipId: number;
  id: number;
  username: string | null;
  firstName: string | null;
  telegramId: string;
  photoUrl: string | null;
  stats: {
    totalScore: number;
    gamesPlayed: number;
    bestScore: number;
  };
  addedAt: string;
};

type FriendRequest = {
  requestId: number;
  id: number;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
  sentAt: string;
};

type FriendsData = {
  friends: Friend[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const ranks = [
  { min: 0, label: "Новичок", icon: "🌱", color: "from-slate-400 to-slate-500", accent: "#64748b" },
  { min: 500, label: "Следопыт", icon: "🎯", color: "from-emerald-500 to-teal-600", accent: "#10b981" },
  { min: 1000, label: "Детектив", icon: "🔍", color: "from-blue-500 to-indigo-600", accent: "#3b82f6" },
  { min: 2000, label: "Профайлер", icon: "🔮", color: "from-violet-500 to-purple-600", accent: "#8b5cf6" },
  { min: 5000, label: "Легенда", icon: "👑", color: "from-amber-400 to-orange-500", accent: "#f59e0b" },
];

function getRank(score: number) {
  for (let i = ranks.length - 1; i >= 0; i--) {
    if (score >= ranks[i].min) return { ...ranks[i], level: i + 1 };
  }
  return { ...ranks[0], level: 1 };
}

// Optimized animated counter - uses requestAnimationFrame efficiently
function useAnimatedCounter(value: number, duration = 1500) {
  const [displayValue, setDisplayValue] = useState(0);
  const frameRef = useRef<number | undefined>(undefined);
  const prevValueRef = useRef(0);
  
  useEffect(() => {
    const startValue = prevValueRef.current;
    const startTime = performance.now();
    
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const newValue = Math.floor(startValue + (value - startValue) * easeOut);
      setDisplayValue(newValue);
      
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = value;
      }
    };
    
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);
  
  return displayValue;
}

// Check if device is touch (mobile)
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);
  return isTouch;
}

const spring = { type: "spring", stiffness: 400, damping: 30 };
const smoothSpring = { type: "spring", stiffness: 200, damping: 20 };

export default function ProfilePage() {
  const router = useRouter();
  const session = useMiniAppSession();
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"stats" | "history" | "friends">("stats");
  
  // Friends
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendUsername, setFriendUsername] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [addFriendError, setAddFriendError] = useState<string | null>(null);
  const [addFriendSuccess, setAddFriendSuccess] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isTouch = useIsTouchDevice();
  
  // Simple tilt state (only for desktop)
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Debounced mouse handler for 3D effect (desktop only)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouch || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
    setTilt({ x, y });
  }, [isTouch]);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  const displayName = useMemo(() => {
    if (session.status !== "ready") return "";
    return session.user.firstName ?? session.user.username ?? "Друг";
  }, [session]);

  const photoUrl = session.status === "ready" ? session.user.photoUrl : null;
  const avatarLetter = displayName ? displayName.slice(0, 1).toUpperCase() : "U";

  useEffect(() => {
    const load = async () => {
      if (session.status !== "ready") {
        setError("Пользователь не авторизован");
        setLoading(false);
        return;
      }
      try {
        setError(null);
        setLoading(true);
        const res = await fetch(`/api/me/summary?userId=${session.user.id}`);
        if (!res.ok) throw new Error("summary_load_failed");
        const json = (await res.json()) as SummaryResponse;
        setData(json);
      } catch (err) {
        console.error("Failed to load profile summary", err);
        setError("Не удалось загрузить профиль");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [session]);

  // Fetch friends
  const loadFriends = useCallback(async () => {
    if (session.status !== "ready") return;
    
    setFriendsLoading(true);
    try {
      const res = await fetch(`/api/friends?userId=${session.user.id}`);
      if (res.ok) {
        const data: FriendsData = await res.json();
        setFriends(data.friends);
        setIncomingRequests(data.incomingRequests);
        setOutgoingRequests(data.outgoingRequests);
      }
    } catch (err) {
      console.error("Failed to load friends", err);
    } finally {
      setFriendsLoading(false);
    }
  }, [session]);
  
  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    if (session.status !== "ready") return;
    
    try {
      // Refresh profile data
      const res = await fetch(`/api/me/summary?userId=${session.user.id}`);
      if (res.ok) {
        const json = (await res.json()) as SummaryResponse;
        setData(json);
      }
      // Refresh friends
      await loadFriends();
    } catch (err) {
      console.error("Failed to refresh", err);
    }
  }, [session, loadFriends]);

  // Add friend (send request)
  const handleAddFriend = async () => {
    if (!friendUsername.trim() || session.status !== "ready") return;
    
    setAddingFriend(true);
    setAddFriendError(null);
    setAddFriendSuccess(null);
    
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          friendUsername: friendUsername.trim(),
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === "user_not_found") {
          setAddFriendError("Пользователь не найден");
        } else if (data.error === "already_friends") {
          setAddFriendError("Уже в друзьях");
        } else if (data.error === "cannot_add_self") {
          setAddFriendError("Нельзя добавить себя");
        } else if (data.error === "request_pending") {
          setAddFriendError("Заявка уже отправлена");
        } else {
          setAddFriendError("Ошибка отправки");
        }
        return;
      }
      
      // Show success message
      if (data.status === "accepted") {
        setAddFriendSuccess("Вы теперь друзья! 🎉");
      } else {
        setAddFriendSuccess("Заявка отправлена! ✉️");
      }
      
      // Reload friends list
      await loadFriends();
      
      setFriendUsername("");
      setTimeout(() => setShowAddFriend(false), 1500);
    } catch (err) {
      setAddFriendError("Ошибка сети");
    } finally {
      setAddingFriend(false);
    }
  };

  // Accept/Decline friend request
  const handleRespondRequest = async (requestId: number, action: "accept" | "decline") => {
    try {
      await fetch("/api/friends", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      await loadFriends();
    } catch (err) {
      console.error("Failed to respond to request", err);
    }
  };

  // Cancel outgoing request
  const handleCancelRequest = async (requestId: number) => {
    try {
      await fetch("/api/friends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId: requestId }),
      });
      await loadFriends();
    } catch (err) {
      console.error("Failed to cancel request", err);
    }
  };

  // Remove friend
  const handleRemoveFriend = async (friendshipId: number) => {
    try {
      await fetch("/api/friends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId }),
      });
      await loadFriends();
    } catch (err) {
      console.error("Failed to remove friend", err);
    }
  };

  // Animated values
  const animatedScore = useAnimatedCounter(data?.stats.totalScore ?? 0, 2000);
  const animatedGames = useAnimatedCounter(data?.stats.totalQuizzesPlayed ?? 0, 1500);
  const animatedCorrect = useAnimatedCounter(data?.stats.totalCorrectAnswers ?? 0, 1800);

  // Loading
  if (loading) {
    return <SkeletonProfilePage />;
  }

  // Error
  if (error || !data) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex min-h-[60vh] flex-col items-center justify-center"
      >
        <div className="text-7xl mb-6 animate-bounce">😔</div>
        <p className="text-[18px] font-semibold text-slate-700">{error ?? "Ошибка загрузки"}</p>
        <p className="mt-2 text-[14px] text-slate-400">Попробуйте позже</p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => router.back()}
          className="mt-8 rounded-2xl bg-gradient-to-r from-[#1a1a2e] to-[#2d1f3d] px-8 py-4 text-[14px] font-semibold text-white shadow-xl"
        >
          ← Вернуться
        </motion.button>
      </motion.div>
    );
  }

  const rank = getRank(data.stats.totalScore);
  const nextRank = ranks[rank.level] ?? null;
  const progress = nextRank ? Math.min((data.stats.totalScore / nextRank.min) * 100, 100) : 100;
  const accuracy = data.stats.totalSessions > 0 
    ? Math.round((data.stats.totalCorrectAnswers / Math.max(data.stats.totalSessions * 10, 1)) * 100) 
    : 0;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-5 pb-10 w-full overflow-x-hidden">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.header 
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="relative z-20 flex items-center justify-between py-3"
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            haptic.light();
            router.back();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/5 gpu-accelerated"
        >
          <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </motion.button>
        
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-2 rounded-full bg-[#0a0a0f] px-4 py-2 shadow-lg"
        >
          <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-[14px] font-semibold text-white/90">Профиль</span>
        </motion.div>
        
        <div className="w-11" />
      </motion.header>

      {/* ═══════════════════════════════════════════════════════════════════
          3D HERO CARD (optimized)
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...smoothSpring, delay: 0.1 }}
        className="relative gpu-accelerated"
        style={{ perspective: isTouch ? "none" : 1000 }}
      >
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="gpu-accelerated"
          style={{ 
            transform: isTouch ? "none" : `rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
            transition: "transform 0.1s ease-out",
          }}
        >
          {/* Animated conic gradient border - CSS animation */}
          <div
            className="absolute -inset-[2px] rounded-[28px] animate-spin-slow gpu-accelerated"
            style={{
              background: `conic-gradient(from 0deg, ${rank.accent}, #8b5cf6, #06b6d4, ${rank.accent})`,
            }}
          />
          
          {/* Outer glow - simplified, smaller to avoid overflow */}
          <div className={`absolute -inset-2 rounded-[30px] bg-gradient-to-r ${rank.color} opacity-20 blur-lg gpu-accelerated`} />
          
          {/* Main card */}
          <div className="relative overflow-hidden rounded-[26px] bg-[#0a0a0f]">
            {/* Static gradient orbs - no animation */}
            <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-violet-600/20 blur-[60px] gpu-accelerated" />
            <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-cyan-600/15 blur-[60px] gpu-accelerated" />

            {/* Floating particles - reduced to 6, CSS animation */}
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white/60 animate-float gpu-accelerated"
                style={{
                  width: 2 + (i % 3),
                  height: 2 + (i % 3),
                  left: `${15 + i * 14}%`,
                  top: `${40 + (i % 3) * 15}%`,
                  animationDelay: `${i * 0.5}s`,
                  animationDuration: `${3 + i * 0.5}s`,
                }}
              />
            ))}

            {/* Content */}
            <div className="relative p-6">
              {/* Top section: Avatar + Info */}
              <div className="flex items-start gap-5">
                {/* Avatar with CSS rotating rings */}
                <div className="relative flex-shrink-0">
                  {/* Outer rotating ring - CSS */}
                  <div
                    className="absolute -inset-3 rounded-full animate-spin-slow gpu-accelerated"
                    style={{
                      background: `conic-gradient(from 0deg, transparent, ${rank.accent}, transparent)`,
                    }}
                  />
                  {/* Middle counter-rotating ring - CSS */}
                  <div className={`absolute -inset-2 rounded-full bg-gradient-to-r ${rank.color} opacity-60 animate-spin-medium reverse gpu-accelerated`} />
                  {/* Inner glow - static */}
                  <div className={`absolute -inset-1 rounded-full bg-gradient-to-r ${rank.color} opacity-40 gpu-accelerated`} />
                  
                  {/* Avatar */}
                  {photoUrl ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3, type: "spring" }}
                    >
                      <img 
                        src={photoUrl} 
                        alt={displayName}
                        className="relative h-24 w-24 rounded-full object-cover ring-4 ring-black gpu-accelerated"
                      />
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3, type: "spring" }}
                      className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#1a1a2e] to-[#2d1f3d] ring-4 ring-black"
                    >
                      <span className="text-3xl font-bold text-white">{avatarLetter}</span>
                    </motion.div>
                  )}
                  
                  {/* Level badge */}
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
                    className={`absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${rank.color} text-[16px] font-black text-white shadow-xl ring-4 ring-[#0a0a0f]`}
                  >
                    {rank.level}
                  </motion.div>
                </div>

                {/* User info */}
                <div className="flex-1 pt-2">
                  <motion.h2
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, ...spring }}
                    className="font-display text-[28px] font-black tracking-tight text-white"
                  >
                    {displayName}
                  </motion.h2>
                  
                  {data.user.username && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="mt-1 text-[14px] text-white/40"
                    >
                      @{data.user.username}
                    </motion.p>
                  )}
                  
                  {/* Rank badge */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.5, type: "spring" }}
                    className={`mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${rank.color} px-4 py-2 shadow-xl`}
                  >
                    <span className="text-[18px]">{rank.icon}</span>
                    <span className="text-[14px] font-bold text-white">{rank.label}</span>
                  </motion.div>
                </div>
              </div>

              {/* Progress to next rank */}
              {nextRank && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-6"
                >
                  <div className="flex items-center justify-between text-[12px] mb-2">
                    <span className="text-white/50">Прогресс до <span className="text-white/80">{nextRank.label}</span></span>
                    <span className="font-mono text-white/70">{data.stats.totalScore} / {nextRank.min}</span>
                  </div>
                  <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ delay: 0.8, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                      className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${rank.color}`}
                    />
                    {/* Shimmer - CSS animation */}
                    <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  </div>
                </motion.div>
              )}

              {/* Giant animated score */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7, type: "spring" }}
                className="mt-6 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Всего очков</p>
                    <p
                      className="font-display text-[56px] font-black leading-none tracking-tighter"
                      style={{ 
                        background: `linear-gradient(135deg, #fff, ${rank.accent}, #fff)`,
                        backgroundSize: "200% 200%",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {animatedScore.toLocaleString()}
                    </p>
                  </div>
                  
                  {/* Mini stats */}
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="font-display text-[24px] font-bold text-white">{animatedGames}</p>
                      <p className="text-[10px] text-white/40">игр</p>
                    </div>
                    <div className="h-10 w-px bg-white/10" />
                    <div className="text-center">
                      <p className="font-display text-[24px] font-bold text-white">{animatedCorrect}</p>
                      <p className="text-[10px] text-white/40">верных</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB SWITCHER
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex gap-2 rounded-2xl bg-white p-2 shadow-xl shadow-black/5"
      >
        {[
          { id: "stats" as const, label: "Статистика", icon: "📊" },
          { id: "history" as const, label: "Рекорды", icon: "🏆" },
          { id: "friends" as const, label: "Друзья", icon: "👥" },
        ].map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => {
              haptic.selection();
              setActiveTab(tab.id);
            }}
            whileTap={{ scale: 0.98 }}
            className={`relative flex-1 rounded-xl py-3.5 text-[14px] font-semibold transition-colors ${
              activeTab === tab.id ? "text-white" : "text-slate-400"
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeProfileTab"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#1a1a2e] to-[#2d1f3d] shadow-lg gpu-accelerated"
                transition={spring}
              />
            )}
            <span className="relative flex items-center justify-center gap-2">
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === "friends" && (friends.length > 0 || incomingRequests.length > 0) && (
                <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white ${
                  incomingRequests.length > 0 ? "bg-red-500 animate-pulse" : "bg-violet-500"
                }`}>
                  {incomingRequests.length > 0 ? incomingRequests.length : friends.length}
                </span>
              )}
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB CONTENT
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {activeTab === "stats" ? (
          <motion.div
            key="stats"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            {/* Stats — 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: "🎮", label: "Игры", value: data.stats.totalQuizzesPlayed, color: "#6366f1" },
                { icon: "🔄", label: "Попытки", value: data.stats.totalSessions, color: "#06b6d4" },
                { icon: "✅", label: "Верные", value: data.stats.totalCorrectAnswers, color: "#10b981" },
                { icon: "🎯", label: "Точность", value: accuracy, suffix: "%", color: "#f59e0b" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i, ...spring }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4 active:scale-[0.98] transition-transform"
                >
                  {/* Content */}
                  <div className="flex items-center gap-3">
                    {/* Circular progress - simplified SVG */}
                    <div className="relative h-14 w-14 flex-shrink-0">
                      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                        <circle
                          cx="28" cy="28" r="24"
                          fill="none"
                          stroke={stat.color}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={150.8}
                          strokeDashoffset={150.8 - (150.8 * Math.min(stat.value / (stat.suffix ? 100 : Math.max(stat.value, 10)), 1))}
                          className="transition-all duration-1000 ease-out"
                          style={{ transitionDelay: `${0.5 + i * 0.1}s` }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg">{stat.icon}</span>
                      </div>
                    </div>
                    
                    {/* Text */}
                    <div>
                      <p className="font-display text-[24px] font-bold text-white leading-none">
                        {stat.value}{stat.suffix}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-white/50 uppercase tracking-wide">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Achievement Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-lg"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-2xl shadow-lg">
                  {data.stats.totalQuizzesPlayed >= 10 ? "🏅" : data.stats.totalQuizzesPlayed >= 5 ? "⭐" : "🎯"}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-[#1a1a2e]">
                    {data.stats.totalQuizzesPlayed >= 10 ? "Активный игрок!" : 
                     data.stats.totalQuizzesPlayed >= 5 ? "Хороший старт!" : 
                     "Начни свой путь!"}
                  </p>
                  <p className="text-[12px] text-slate-400">
                    {data.stats.totalQuizzesPlayed >= 10 ? `${data.stats.totalQuizzesPlayed} викторин пройдено` :
                     data.stats.totalQuizzesPlayed >= 5 ? `Ещё ${10 - data.stats.totalQuizzesPlayed} до медали` :
                     `Пройди ${5 - data.stats.totalQuizzesPlayed} викторин для звезды`}
                  </p>
                </div>
                <span className="text-slate-300 animate-pulse">→</span>
              </div>
              
              {/* Progress bar */}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((data.stats.totalQuizzesPlayed / 10) * 100, 100)}%` }}
                  transition={{ delay: 0.6, duration: 1 }}
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-600"
                />
              </div>
            </motion.div>

            {/* Last Game */}
            {data.stats.lastSession && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="overflow-hidden rounded-2xl bg-white shadow-xl shadow-black/5"
              >
                <div className="bg-gradient-to-r from-[#1a1a2e] to-[#2d1f3d] p-4">
                  <div className="flex items-center gap-2">
                    <span>🕐</span>
                    <span className="text-[13px] font-semibold text-white/80">Последняя игра</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[16px] font-bold text-[#1a1a2e]">{data.stats.lastSession.quizTitle}</p>
                      <p className="mt-1 text-[12px] text-slate-400">{formatDate(data.stats.lastSession.finishedAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-[28px] font-black text-[#1a1a2e]">{data.stats.lastSession.score}</p>
                      <p className="text-[11px] text-slate-400">очков</p>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(`/miniapp/quiz/${data.stats.lastSession?.quizId}`)}
                    className={`mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${rank.color} text-[15px] font-bold text-white shadow-xl`}
                  >
                    ▶ Играть снова
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : activeTab === "history" ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl bg-white p-5 shadow-xl shadow-black/5"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-[17px] font-bold text-[#1a1a2e]">Лучшие результаты</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-500">
                {data.stats.bestScoreByQuiz.length} игр
              </span>
            </div>
            
            {data.stats.bestScoreByQuiz.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <div className="text-7xl animate-bounce">🎯</div>
                <p className="mt-6 text-[16px] font-semibold text-slate-600">Пока нет рекордов</p>
                <p className="mt-2 text-[14px] text-slate-400">Пройди свою первую викторину!</p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push("/miniapp")}
                  className="mt-6 rounded-xl bg-gradient-to-r from-[#1a1a2e] to-[#2d1f3d] px-8 py-4 text-[14px] font-semibold text-white shadow-xl"
                >
                  К викторинам →
                </motion.button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {data.stats.bestScoreByQuiz.map((item, i) => (
                  <motion.button
                    key={item.quizId}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08, ...spring }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(`/miniapp/quiz/${item.quizId}`)}
                    className="group flex items-center gap-4 rounded-xl bg-slate-50 p-4 text-left active:bg-slate-100"
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl shadow-lg ${
                      i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500" :
                      i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400" :
                      i === 2 ? "bg-gradient-to-br from-orange-400 to-amber-600" :
                      "bg-slate-200"
                    }`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-[14px] font-bold text-slate-500">{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#1a1a2e]">{item.title}</p>
                      <p className="text-[12px] text-slate-400">Нажми для повтора</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-[22px] font-black text-[#1a1a2e]">{item.bestScore}</p>
                    </div>
                    <svg 
                      className="h-5 w-5 text-slate-300" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        ) : activeTab === "friends" ? (
          <motion.div
            key="friends"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            {/* Add Friend Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                haptic.medium();
                setShowAddFriend(true);
              }}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-[15px] font-bold text-white shadow-lg shadow-violet-500/25"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Добавить друга
            </motion.button>

            {/* Loading */}
            {friendsLoading ? (
              <div className="rounded-2xl bg-white shadow-lg shadow-black/5 overflow-hidden divide-y divide-slate-50">
                {[0, 1, 2].map((i) => (
                  <SkeletonFriendCard key={i} index={i} />
                ))}
              </div>
            ) : (
              <>
                {/* Incoming Requests */}
                {incomingRequests.length > 0 && (
                  <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 p-4 shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">📬</span>
                      <h3 className="text-[14px] font-bold text-white">Заявки в друзья</h3>
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-bold text-white">
                        {incomingRequests.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {incomingRequests.map((req) => {
                        const reqName = req.firstName ?? req.username ?? "Пользователь";
                        return (
                          <div key={req.requestId} className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
                            {req.photoUrl ? (
                              <img src={req.photoUrl} alt={reqName} className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-[13px] font-bold text-white">
                                {reqName[0].toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-semibold text-white truncate">{reqName}</p>
                              {req.username && <p className="text-[11px] text-white/60">@{req.username}</p>}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  haptic.success();
                                  handleRespondRequest(req.requestId, "accept");
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white active:bg-emerald-600"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  haptic.light();
                                  handleRespondRequest(req.requestId, "decline");
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white active:bg-white/30"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Outgoing Requests */}
                {outgoingRequests.length > 0 && (
                  <div className="rounded-2xl bg-white p-4 shadow-lg shadow-black/5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">📤</span>
                      <h3 className="text-[14px] font-bold text-[#1a1a2e]">Отправленные заявки</h3>
                    </div>
                    <div className="space-y-2">
                      {outgoingRequests.map((req) => {
                        const reqName = req.firstName ?? req.username ?? "Пользователь";
                        return (
                          <div key={req.requestId} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                            {req.photoUrl ? (
                              <img src={req.photoUrl} alt={reqName} className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1a1a2e] to-[#2d1f3d] text-[13px] font-bold text-white">
                                {reqName[0].toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-semibold text-[#1a1a2e] truncate">{reqName}</p>
                              <p className="text-[11px] text-slate-400">Ожидает подтверждения...</p>
                            </div>
                            <button
                              onClick={() => {
                                haptic.light();
                                handleCancelRequest(req.requestId);
                              }}
                              className="rounded-lg bg-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 active:bg-slate-300"
                            >
                              Отменить
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Friends List */}
                {friends.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                  <div className="rounded-2xl bg-white p-8 shadow-lg shadow-black/5 text-center">
                    <span className="text-6xl mb-4 block">👥</span>
                    <p className="text-[16px] font-bold text-[#1a1a2e]">Пока нет друзей</p>
                    <p className="text-[14px] text-slate-400 mt-2">
                      Отправь заявку по username,<br />друг получит уведомление
                    </p>
                  </div>
                ) : friends.length > 0 && (
                  <div className="rounded-2xl bg-white shadow-lg shadow-black/5 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <h3 className="text-[14px] font-bold text-[#1a1a2e]">Мои друзья ({friends.length})</h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {friends.map((friend, i) => {
                        const friendName = friend.firstName ?? friend.username ?? "Друг";
                        const friendRank = getRank(friend.stats.totalScore);
                        
                        return (
                          <motion.div
                            key={friend.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05, ...spring }}
                            className="p-4"
                          >
                            <div className="flex items-center gap-3 mb-3">
<div className="relative">
                            <div className={`absolute -inset-0.5 rounded-full bg-gradient-to-r ${friendRank.color} opacity-60`} />
                            {friend.photoUrl ? (
                              <img src={friend.photoUrl} alt={friendName} className="relative h-12 w-12 rounded-full object-cover" />
                            ) : (
                              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#1a1a2e] to-[#2d1f3d] text-[14px] font-bold text-white">
                                {friendName[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                              
                              <div className="flex-1 min-w-0">
                                <p className="text-[15px] font-bold text-[#1a1a2e] truncate">{friendName}</p>
                                {friend.username && (
                                  <p className="text-[12px] text-slate-400">@{friend.username}</p>
                                )}
                              </div>
                              
                              <div className={`flex items-center gap-1.5 rounded-full bg-gradient-to-r ${friendRank.color} px-3 py-1`}>
                                <span className="text-sm">{friendRank.icon}</span>
                                <span className="text-[11px] font-bold text-white">{friendRank.level}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                              <div className="text-center flex-1">
                                <p className="font-display text-[18px] font-bold text-[#1a1a2e]">{friend.stats.totalScore}</p>
                                <p className="text-[10px] text-slate-400">очков</p>
                              </div>
                              <div className="h-8 w-px bg-slate-200" />
                              <div className="text-center flex-1">
                                <p className="font-display text-[18px] font-bold text-[#1a1a2e]">{friend.stats.gamesPlayed}</p>
                                <p className="text-[10px] text-slate-400">игр</p>
                              </div>
                              <div className="h-8 w-px bg-slate-200" />
                              <div className="text-center flex-1">
                                <p className="font-display text-[18px] font-bold text-[#1a1a2e]">{friend.stats.bestScore}</p>
                                <p className="text-[10px] text-slate-400">рекорд</p>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => {
                                haptic.warning();
                                handleRemoveFriend(friend.friendshipId);
                              }}
                              className="mt-3 w-full rounded-lg bg-red-50 py-2 text-[12px] font-semibold text-red-500 active:bg-red-100"
                            >
                              Удалить из друзей
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          ADD FRIEND MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAddFriend && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => {
              setShowAddFriend(false);
              setFriendUsername("");
              setAddFriendError(null);
              setAddFriendSuccess(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600">
                  <span className="text-3xl">👥</span>
                </div>
                <h2 className="font-display text-[20px] font-bold text-[#1a1a2e]">Добавить друга</h2>
                <p className="text-[14px] text-slate-400 mt-1">Введи username друга в Telegram</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={friendUsername}
                    onChange={(e) => {
                      setFriendUsername(e.target.value);
                      setAddFriendError(null);
                    }}
                    placeholder="@username"
                    className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-[15px] font-medium text-[#1a1a2e] outline-none transition-colors focus:border-violet-500 placeholder:text-slate-300"
                  />
                  {addFriendError && (
                    <p className="mt-2 text-[13px] text-red-500">{addFriendError}</p>
                  )}
                  {addFriendSuccess && (
                    <p className="mt-2 text-[13px] text-emerald-500 font-semibold">{addFriendSuccess}</p>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      haptic.light();
                      setShowAddFriend(false);
                      setFriendUsername("");
                      setAddFriendError(null);
                      setAddFriendSuccess(null);
                    }}
                    className="flex-1 rounded-xl bg-slate-100 py-3.5 text-[14px] font-semibold text-slate-600 active:bg-slate-200"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      haptic.medium();
                      handleAddFriend();
                    }}
                    disabled={addingFriend || !friendUsername.trim()}
                    className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-violet-500/25 disabled:opacity-50"
                  >
                    {addingFriend ? "Добавляем..." : "Добавить"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          BACK BUTTON
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.button
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          haptic.light();
          router.push("/miniapp");
        }}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-slate-600 shadow-lg shadow-black/5"
      >
        ← На главную
      </motion.button>
    </div>
    </PullToRefresh>
  );
}
