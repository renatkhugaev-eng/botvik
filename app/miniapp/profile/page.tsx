"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMiniAppSession } from "../layout";

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

// Animated counter hook
function useAnimatedCounter(value: number, duration = 1500) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    const startValue = displayValue;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(startValue + (value - startValue) * easeOut));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);
  
  return displayValue;
}

const spring = { type: "spring", stiffness: 400, damping: 30 };
const smoothSpring = { type: "spring", stiffness: 200, damping: 20 };

export default function ProfilePage() {
  const router = useRouter();
  const session = useMiniAppSession();
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"stats" | "history">("stats");
  const cardRef = useRef<HTMLDivElement>(null);
  
  // 3D tilt effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), { stiffness: 300, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

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

  // Animated values
  const animatedScore = useAnimatedCounter(data?.stats.totalScore ?? 0, 2000);
  const animatedGames = useAnimatedCounter(data?.stats.totalQuizzesPlayed ?? 0, 1500);
  const animatedCorrect = useAnimatedCounter(data?.stats.totalCorrectAnswers ?? 0, 1800);

  // Loading
  if (loading) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4">
        <motion.div
          className="relative h-16 w-16"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 opacity-75 blur-md" />
          <div className="absolute inset-1 rounded-full bg-slate-100" />
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-[14px] font-medium text-slate-400"
        >
          Загрузка профиля...
        </motion.p>
      </div>
    );
  }

  // Error
  if (error || !data) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex min-h-[60vh] flex-col items-center justify-center"
      >
        <motion.div
          animate={{ y: [0, -15, 0], rotateZ: [0, -5, 5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-7xl mb-6"
        >
          😔
        </motion.div>
        <p className="text-[18px] font-semibold text-slate-700">{error ?? "Ошибка загрузки"}</p>
        <p className="mt-2 text-[14px] text-slate-400">Попробуйте позже</p>
        <motion.button
          whileHover={{ scale: 1.05 }}
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
    <div className="flex flex-col gap-5 pb-10">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.header 
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="flex items-center justify-between py-3"
      >
        <motion.button
          whileHover={{ scale: 1.1, rotate: -5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/5"
        >
          <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </motion.button>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2"
        >
          <motion.span
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="text-xl"
          >
            👤
          </motion.span>
          <h1 className="font-display text-[20px] font-bold text-[#1a1a2e]">Профиль</h1>
        </motion.div>
        
        <div className="w-11" />
      </motion.header>

      {/* ═══════════════════════════════════════════════════════════════════
          3D HERO CARD
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...smoothSpring, delay: 0.1 }}
        style={{ perspective: 1000 }}
        className="relative cursor-default"
      >
        <motion.div
          style={{ 
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
        >
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
        {/* Animated conic gradient border */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-[2px] rounded-[28px]"
          style={{
            background: `conic-gradient(from 0deg, ${rank.accent}, #8b5cf6, #06b6d4, ${rank.accent})`,
          }}
        />
        
        {/* Outer glow pulse */}
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className={`absolute -inset-4 rounded-[36px] bg-gradient-to-r ${rank.color} opacity-30 blur-2xl`}
        />
        
        {/* Main card */}
        <div className="relative overflow-hidden rounded-[26px] bg-[#0a0a0f]">
          {/* Noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />
          
          {/* Animated gradient orbs */}
          <motion.div
            animate={{ 
              x: [0, 30, 0],
              y: [0, -20, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-violet-600/30 blur-[80px]"
          />
          <motion.div
            animate={{ 
              x: [0, -30, 0],
              y: [0, 20, 0],
              scale: [1.2, 1, 1.2],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-cyan-600/20 blur-[80px]"
          />
          <motion.div
            animate={{ 
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{ duration: 5, repeat: Infinity }}
            className={`absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r ${rank.color} blur-[60px]`}
          />

          {/* Floating particles */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -40 - i * 5, 0],
                x: [0, (i % 2 === 0 ? 15 : -15), 0],
                opacity: [0, 0.8, 0],
                scale: [0.5, 1, 0.5],
              }}
              transition={{ 
                duration: 4 + i * 0.5, 
                repeat: Infinity, 
                delay: i * 0.3,
                ease: "easeInOut"
              }}
              className="absolute rounded-full bg-white"
              style={{
                width: 2 + (i % 3),
                height: 2 + (i % 3),
                left: `${10 + i * 7}%`,
                top: `${50 + (i % 4) * 10}%`,
              }}
            />
          ))}

          {/* Content */}
          <div className="relative p-6" style={{ transform: "translateZ(20px)" }}>
            {/* Top section: Avatar + Info */}
            <div className="flex items-start gap-5">
              {/* Avatar with multiple rotating rings */}
              <div className="relative flex-shrink-0">
                {/* Outer rotating ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-3 rounded-full"
                  style={{
                    background: `conic-gradient(from 0deg, transparent, ${rank.accent}, transparent)`,
                  }}
                />
                {/* Middle counter-rotating ring */}
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className={`absolute -inset-2 rounded-full bg-gradient-to-r ${rank.color} opacity-60`}
                />
                {/* Inner glow */}
                <div className={`absolute -inset-1 rounded-full bg-gradient-to-r ${rank.color} blur-md opacity-50`} />
                
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
                      className="relative h-24 w-24 rounded-full object-cover ring-4 ring-black"
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
                
                {/* Animated level badge */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
                  className={`absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${rank.color} text-[16px] font-black text-white shadow-xl ring-4 ring-[#0a0a0f]`}
                  style={{ boxShadow: `0 0 20px ${rank.accent}` }}
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
                  whileHover={{ scale: 1.05 }}
                  className={`mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${rank.color} px-4 py-2 shadow-xl`}
                  style={{ boxShadow: `0 10px 30px ${rank.accent}40` }}
                >
                  <motion.span
                    animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                    className="text-[18px]"
                  >
                    {rank.icon}
                  </motion.span>
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
                  {/* Shimmer effect */}
                  <motion.div
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  />
                </div>
              </motion.div>
            )}

            {/* Giant animated score */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, type: "spring" }}
              className="mt-6 rounded-2xl bg-white/[0.03] p-5 backdrop-blur-sm ring-1 ring-white/10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Всего очков</p>
                  <motion.p
                    className="font-display text-[56px] font-black leading-none tracking-tighter"
                    style={{ 
                      background: `linear-gradient(135deg, #fff, ${rank.accent}, #fff)`,
                      backgroundSize: "200% 200%",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      textShadow: `0 0 60px ${rank.accent}50`,
                    }}
                  >
                    {animatedScore.toLocaleString()}
                  </motion.p>
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
        ].map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`relative flex-1 rounded-xl py-3.5 text-[14px] font-semibold transition-colors ${
              activeTab === tab.id ? "text-white" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeProfileTab"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#1a1a2e] to-[#2d1f3d] shadow-lg"
                transition={spring}
              />
            )}
            <span className="relative flex items-center justify-center gap-2">
              <motion.span
                animate={activeTab === tab.id ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5 }}
              >
                {tab.icon}
              </motion.span>
              {tab.label}
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
            initial={{ opacity: 0, x: -50, filter: "blur(10px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 50, filter: "blur(10px)" }}
            transition={spring}
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
                  whileTap={{ scale: 0.97 }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4"
                >
                  {/* Content */}
                  <div className="flex items-center gap-3">
                    {/* Circular progress */}
                    <div className="relative h-14 w-14 flex-shrink-0">
                      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                        <motion.circle
                          cx="28" cy="28" r="24"
                          fill="none"
                          stroke={stat.color}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={150.8}
                          initial={{ strokeDashoffset: 150.8 }}
                          animate={{ strokeDashoffset: 150.8 - (150.8 * Math.min(stat.value / (stat.suffix ? 100 : Math.max(stat.value, 10)), 1)) }}
                          transition={{ delay: 0.5 + i * 0.1, duration: 1.5, ease: "easeOut" }}
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
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-2xl shadow-lg shadow-violet-500/30"
                >
                  {data.stats.totalQuizzesPlayed >= 10 ? "🏅" : data.stats.totalQuizzesPlayed >= 5 ? "⭐" : "🎯"}
                </motion.div>
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
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-slate-300"
                >
                  →
                </motion.div>
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
                    <motion.span
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                      🕐
                    </motion.span>
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
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(`/miniapp/quiz/${data.stats.lastSession?.quizId}`)}
                    className={`mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${rank.color} text-[15px] font-bold text-white shadow-xl`}
                    style={{ boxShadow: `0 10px 30px ${rank.accent}30` }}
                  >
                    <motion.span
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      ▶
                    </motion.span>
                    Играть снова
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 50, filter: "blur(10px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -50, filter: "blur(10px)" }}
            transition={spring}
            className="rounded-2xl bg-white p-5 shadow-xl shadow-black/5"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-[17px] font-bold text-[#1a1a2e]">Лучшие результаты</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-500">
                {data.stats.bestScoreByQuiz.length} игр
              </span>
            </div>
            
            {data.stats.bestScoreByQuiz.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center py-12"
              >
                <motion.div
                  animate={{ 
                    y: [0, -20, 0],
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="text-7xl"
                >
                  🎯
                </motion.div>
                <p className="mt-6 text-[16px] font-semibold text-slate-600">Пока нет рекордов</p>
                <p className="mt-2 text-[14px] text-slate-400">Пройди свою первую викторину!</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push("/miniapp")}
                  className="mt-6 rounded-xl bg-gradient-to-r from-[#1a1a2e] to-[#2d1f3d] px-8 py-4 text-[14px] font-semibold text-white shadow-xl"
                >
                  К викторинам →
                </motion.button>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-3">
                {data.stats.bestScoreByQuiz.map((item, i) => (
                  <motion.button
                    key={item.quizId}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08, ...spring }}
                    whileHover={{ scale: 1.02, x: 8 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(`/miniapp/quiz/${item.quizId}`)}
                    className="group flex items-center gap-4 rounded-xl bg-slate-50 p-4 text-left transition-all hover:bg-slate-100 hover:shadow-lg"
                  >
                    <motion.div 
                      whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                      className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl shadow-lg ${
                        i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/30" :
                        i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400 shadow-slate-400/30" :
                        i === 2 ? "bg-gradient-to-br from-orange-400 to-amber-600 shadow-orange-500/30" :
                        "bg-slate-200"
                      }`}
                    >
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-[14px] font-bold text-slate-500">{i + 1}</span>}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#1a1a2e]">{item.title}</p>
                      <p className="text-[12px] text-slate-400">Нажми для повтора</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-[22px] font-black text-[#1a1a2e]">{item.bestScore}</p>
                    </div>
                    <motion.svg 
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="h-5 w-5 text-slate-300 group-hover:text-slate-500" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </motion.svg>
                  </motion.button>
                ))}
              </div>
            )}
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
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => router.push("/miniapp")}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-slate-600 shadow-lg shadow-black/5"
      >
        <motion.span
          animate={{ x: [0, -4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          ←
        </motion.span>
        На главную
      </motion.button>
    </div>
  );
}
