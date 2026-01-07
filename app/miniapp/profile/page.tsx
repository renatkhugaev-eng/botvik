"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useMiniAppSession } from "../layout";
import { haptic } from "@/lib/haptic";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SkeletonProfilePage, SkeletonFriendCard } from "@/components/Skeleton";
import { fetchWithAuth } from "@/lib/api";
import { useScrollPerfMode } from "@/components/hooks/useScrollPerfMode";
import { useDeviceTier } from "@/components/hooks/useDeviceTier";
import { usePerfMode } from "@/components/context/PerfModeContext";
import { useIsIOS } from "@/components/hooks/usePlatform";
import { ReferralSection } from "@/components/ReferralSection";
import { AvatarWithFrame } from "@/components/AvatarWithFrame";
import { InventorySection } from "@/components/InventorySection";
import { 
  LazyAchievementsSection, 
  LazyRecentOpponents, 
  LazyProfileEditor 
} from "@/components/lazy";
import { resetTour } from "@/components/onboarding/tourSteps";

// Profile 2.0 Components
import { 
  StatusBadge, 
  CurrentlyPlaying, 
  AchievementShowcase, 
  ProfileBio,
  LastSeen 
} from "@/components/ProfileShowcase";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Platform detection moved to @/components/hooks/usePlatform

type SummaryResponse = {
  user: {
    id: number;
    telegramId?: string; // Optional for public profiles (security)
    username: string | null;
    firstName: string | null;
    lastName?: string | null;
    photoUrl?: string | null;
    equippedFrame?: {
      id: number;
      slug: string;
      imageUrl: string;
      title: string;
    } | null;
  };
  stats: {
    totalScore: number;
    totalSessions?: number; // Not available for public profiles
    totalQuizzesPlayed?: number; // Not available for public profiles
    totalCorrectAnswers?: number; // Not available for public profiles
    totalAnswers?: number; // Not available for public profiles
    globalRank: number | null;
    totalPlayers: number;
    xp: {
      total?: number; // Not available for public profiles
      level: number;
      progress?: number; // Not available for public profiles
      currentLevelXp?: number;
      nextLevelXp?: number;
      xpInCurrentLevel?: number;
      xpNeededForNext?: number;
      title: string;
      icon: string;
      color: string;
    };
    bestScoreByQuiz?: { 
      quizId: number; 
      title: string; 
      bestSessionScore: number;
      leaderboardScore: number;
      attempts: number;
    }[];
    lastSession?: { quizId: number; quizTitle: string; score: number; finishedAt: string | Date } | null;
    todayAttempts?: { quizId: number; attempts: number; remaining: number }[];
    maxDailyAttempts?: number;
    globalEnergy?: {
      used: number;
      remaining: number;
      max: number;
      hoursPerAttempt: number;
      bonus: number;
    };
    duelStats?: {
      wins: number;
      losses: number;
      draws: number;
      total: number;
      winRate: number; // В процентах (0-100)
      currentStreak: number;
      bestStreak: number;
    };
  };
  isPublicProfile?: boolean;
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

// Profile 2.0 Types
type UserStatus = "ONLINE" | "PLAYING" | "LOOKING_DUEL" | "BUSY" | "OFFLINE";

type PresetStatus = {
  id: string;
  emoji: string;
  text: string;
  status: UserStatus;
};

type Profile2Data = {
  bio: string | null;
  status: UserStatus | null;
  statusEmoji: string | null;
  statusText: string | null;
  lastSeenAt: string | null;
  showcaseAchievements: string[];
  unlockedAchievements: string[];
  currentlyPlaying: {
    quizId: number;
    title: string;
    since: string | null;
  } | null;
  privacy?: {
    profilePublic: boolean;
    showActivity: boolean;
    showOnlineStatus: boolean;
  };
  presetStatuses: PresetStatus[];
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Правильное склонение русских числительных
 * @param n - число
 * @param forms - [одна, две-четыре, пять+] например ["победа", "победы", "побед"]
 */
function pluralize(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  const lastTwo = abs % 100;
  const lastOne = abs % 10;
  
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2]; // 11-14 → "побед"
  if (lastOne === 1) return forms[0]; // 1, 21, 31 → "победа"
  if (lastOne >= 2 && lastOne <= 4) return forms[1]; // 2-4, 22-24 → "победы"
  return forms[2]; // 0, 5-9, 10 → "побед"
}

const ranks = [
  { min: 0, label: "Новичок", icon: "🔰", color: "from-slate-400 to-slate-500", accent: "#64748b" },
  { min: 500, label: "Следопыт", icon: "🔍", color: "from-emerald-500 to-teal-600", accent: "#10b981" },
  { min: 1000, label: "Детектив", icon: "🕵️", color: "from-blue-500 to-indigo-600", accent: "#3b82f6" },
  { min: 2000, label: "Профайлер", icon: "🎖️", color: "from-violet-500 to-purple-600", accent: "#8b5cf6" },
  { min: 5000, label: "Легенда", icon: "👑", color: "from-amber-400 to-orange-500", accent: "#f59e0b" },
];

function getRank(score: number) {
  for (let i = ranks.length - 1; i >= 0; i--) {
    if (score >= ranks[i].min) return { ...ranks[i], level: i + 1 };
  }
  return { ...ranks[0], level: 1 };
}

// Optimized animated counter
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

// Notification toggle component with shadcn style
function NotificationToggle({ 
  label, 
  description, 
  icon, 
  enabled, 
  onChange 
}: { 
  label: string; 
  description: string; 
  icon: React.ReactNode; 
  enabled: boolean; 
  onChange: (value: boolean) => void;
}) {
  return (
    <div 
      className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
      onClick={() => onChange(!enabled)}
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">{icon}</span>
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div 
        className={`relative w-11 h-6 rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <div 
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
}

const spring = { type: "spring", stiffness: 400, damping: 30 };
const smoothSpring = { type: "spring", stiffness: 200, damping: 20 };

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useMiniAppSession();
  const isIOS = useIsIOS();
  const { config } = useDeviceTier();
  const { setPerfMode } = usePerfMode();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useScrollPerfMode({ 
    target: scrollRef, 
    debounceMs: config.scrollDebounceMs 
  });
  
  const viewingUserId = searchParams.get("userId");
  const parsedViewingUserId = viewingUserId ? parseInt(viewingUserId, 10) : null;
  const isValidViewingUserId = parsedViewingUserId !== null && !isNaN(parsedViewingUserId);
  const isViewingOther = isValidViewingUserId && session.status === "ready" && parsedViewingUserId !== session.user.id;
  const targetUserId = isValidViewingUserId ? parsedViewingUserId : (session.status === "ready" ? session.user.id : null);
  
  useEffect(() => {
    setPerfMode(isScrolling);
  }, [isScrolling, setPerfMode]);
  
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("stats");
  
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
  
  // Notification settings
  const [notifySettings, setNotifySettings] = useState({
    notifyLevelUp: true,
    notifyEnergyFull: true,
    notifyDailyReminder: true,
    notifyLeaderboard: false,
    notifyFriends: true,
  });
  
  // Profile 2.0 state
  const [profile2Data, setProfile2Data] = useState<Profile2Data | null>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);

  const displayName = useMemo(() => {
    if (isViewingOther && data?.user) {
      return data.user.firstName ?? data.user.username ?? "Игрок";
    }
    if (session.status !== "ready") return "";
    return session.user.firstName ?? session.user.username ?? "Друг";
  }, [session, data, isViewingOther]);

  const photoUrl = useMemo(() => {
    if (isViewingOther && data?.user) {
      return data.user.photoUrl ?? null;
    }
    return session.status === "ready" ? session.user.photoUrl : null;
  }, [session, data, isViewingOther]);
  
  const avatarLetter = displayName ? displayName.slice(0, 1).toUpperCase() : "U";

  // Data loading
  const loadAllData = useCallback(async () => {
    if (session.status !== "ready" || !targetUserId) {
      setError("Пользователь не авторизован");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setFriendsLoading(true);
    setError(null);
    
    try {
      const [profileRes, friendsRes, notifyRes, profile2Res] = await Promise.all([
        fetchWithAuth(`/api/me/summary?userId=${targetUserId}`),
        !isViewingOther ? fetchWithAuth(`/api/friends?userId=${targetUserId}`).catch(() => null) : Promise.resolve(null),
        !isViewingOther ? fetchWithAuth(`/api/notifications/settings?userId=${targetUserId}`).catch(() => null) : Promise.resolve(null),
        // Profile 2.0 data
        fetchWithAuth(`/api/me/profile?userId=${targetUserId}`).catch(() => null),
      ]);
      
      if (!profileRes.ok) throw new Error("summary_load_failed");
      const profileData = (await profileRes.json()) as SummaryResponse;
      setData(profileData);
      
      if (friendsRes?.ok) {
        const friendsData: FriendsData = await friendsRes.json();
        setFriends(friendsData.friends);
        setIncomingRequests(friendsData.incomingRequests);
        setOutgoingRequests(friendsData.outgoingRequests);
      }
      
      if (notifyRes?.ok) {
        const notifyData = await notifyRes.json();
        if (notifyData.settings) {
          setNotifySettings(notifyData.settings);
        }
      }
      
      // Profile 2.0 data
      if (profile2Res?.ok) {
        const profile2Json = await profile2Res.json();
        if (profile2Json.ok && profile2Json.data) {
          setProfile2Data(profile2Json.data);
        }
      }
    } catch (err) {
      console.error("Failed to load profile data", err);
      setError("Не удалось загрузить профиль");
    } finally {
      setLoading(false);
      setFriendsLoading(false);
    }
  }, [session, targetUserId, isViewingOther]);
  
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);
  
  const loadFriends = useCallback(async () => {
    if (session.status !== "ready") return;
    
    setFriendsLoading(true);
    try {
      const res = await fetchWithAuth(`/api/friends?userId=${session.user.id}`);
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
  
  const updateNotifySetting = async (key: string, value: boolean) => {
    if (session.status !== "ready") return;
    
    setNotifySettings(prev => ({ ...prev, [key]: value }));
    haptic.selection();
    
    try {
      await fetchWithAuth("/api/notifications/settings", {
        method: "PUT",
        body: JSON.stringify({
          settings: { [key]: value },
        }),
      });
    } catch (err) {
      console.error("Failed to update notification setting", err);
      setNotifySettings(prev => ({ ...prev, [key]: !value }));
    }
  };

  const handleRefresh = useCallback(async () => {
    await loadAllData();
  }, [loadAllData]);

  const handleAddFriend = async () => {
    if (!friendUsername.trim() || session.status !== "ready") return;
    
    setAddingFriend(true);
    setAddFriendError(null);
    setAddFriendSuccess(null);
    
    try {
      const res = await fetchWithAuth("/api/friends", {
        method: "POST",
        body: JSON.stringify({
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
      
      if (data.status === "accepted") {
        setAddFriendSuccess("Вы теперь друзья! 🎉");
      } else {
        setAddFriendSuccess("Заявка отправлена! ✉️");
      }
      
      await loadFriends();
      
      setFriendUsername("");
      setTimeout(() => setShowAddFriend(false), 1500);
    } catch (err) {
      setAddFriendError("Ошибка сети");
    } finally {
      setAddingFriend(false);
    }
  };

  const handleRespondRequest = async (requestId: number, action: "accept" | "decline") => {
    try {
      await fetchWithAuth("/api/friends", {
        method: "PUT",
        body: JSON.stringify({ requestId, action }),
      });
      await loadFriends();
    } catch (err) {
      console.error("Failed to respond to request", err);
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    try {
      await fetchWithAuth("/api/friends", {
        method: "DELETE",
        body: JSON.stringify({ friendshipId: requestId }),
      });
      await loadFriends();
    } catch (err) {
      console.error("Failed to cancel request", err);
    }
  };

  const handleRemoveFriend = async (friendshipId: number) => {
    try {
      await fetchWithAuth("/api/friends", {
        method: "DELETE",
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
        className="flex min-h-[60vh] flex-col items-center justify-center p-6"
      >
        <div className="text-7xl mb-6 animate-bounce">😔</div>
        <p className="text-lg font-semibold">{error ?? "Ошибка загрузки"}</p>
        <p className="mt-2 text-sm text-muted-foreground">Попробуйте позже</p>
        <Button
          variant="default"
          onClick={() => router.back()}
          className="mt-8"
        >
          ← Вернуться
        </Button>
      </motion.div>
    );
  }

  // XP-based level system from API
  const xp = data.stats.xp ?? { total: 0, level: 1, progress: 0, title: "Новичок", icon: "🌱", color: "from-slate-400 to-slate-500", xpInCurrentLevel: 0, xpNeededForNext: 100 };
  
  const rankFromTitle = ranks.find(r => r.label === xp.title) ?? ranks[0];
  const rank = { 
    level: xp.level, 
    label: xp.title, 
    icon: rankFromTitle.icon,
    color: xp.color, 
    accent: rankFromTitle.accent 
  };
  const progress = xp.progress;
  
  const accuracy = (data.stats.totalAnswers ?? 0) > 0 
    ? Math.round(((data.stats.totalCorrectAnswers ?? 0) / data.stats.totalAnswers!) * 100) 
    : 0;
  
  const globalRankText = data.stats.globalRank 
    ? `${data.stats.globalRank} из ${data.stats.totalPlayers}` 
    : null;

  return (
    <PullToRefresh 
      onRefresh={handleRefresh} 
      scrollRef={scrollRef}
    >
    <div className={`relative flex flex-col gap-6 min-h-screen bg-gradient-to-b from-[#f5f5f7] to-[#e8e8ec] px-4 pt-3 pb-24 w-full overflow-x-hidden ${isScrolling && !isIOS ? "perf" : ""}`}>
      {/* Header — стиль как на главной */}
      <motion.header 
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="relative z-20 flex h-14 items-center justify-between"
      >
        {/* Back button — белая с тенью как на главной */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            haptic.light();
            router.back();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </motion.button>
        
        {/* Center badge — тёмный стиль как счётчик игроков */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-[#1a1a2e] px-4 py-2"
        >
          <div className={`h-2 w-2 rounded-full ${isViewingOther ? "bg-blue-500" : "bg-gradient-to-r from-cyan-400 to-violet-500"} animate-pulse`} />
          <span className="text-sm font-bold text-white">
            {isViewingOther ? displayName : "Профиль"}
          </span>
        </motion.div>
        
        {/* Right buttons */}
        <div className="flex items-center gap-2">
          {!isViewingOther && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                haptic.medium();
                router.push("/miniapp/shop");
              }}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/25"
            >
              <span className="text-lg">🛒</span>
            </motion.button>
          )}
          
          {!isViewingOther && data.user.telegramId === "5731136459" && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                haptic.medium();
                window.open("/admin", "_blank");
              }}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25"
            >
              <span className="text-lg">⚙️</span>
            </motion.button>
          )}
        </div>
      </motion.header>

      {/* Hero Section - Purple Gradient Glassmorphism */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...smoothSpring, delay: 0.1 }}
        className="relative"
      >
        {/* Strong purple glow effect */}
        <div 
          className="absolute -inset-4 rounded-3xl pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.35) 0%, rgba(124, 58, 237, 0.15) 50%, transparent 70%)',
          }}
        />
        
        <div 
          className="relative overflow-hidden rounded-[20px] p-1"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4) 0%, rgba(124, 58, 237, 0.3) 50%, rgba(99, 102, 241, 0.4) 100%)',
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4), 0 0 80px rgba(139, 92, 246, 0.2)',
          }}
        >
          {/* Animated gradient border */}
          <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-violet-500/40 via-purple-500/30 to-indigo-500/40 opacity-80 animate-pulse pointer-events-none" />
          
          {/* Decorative elements - stronger glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/25 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          
          <div className="relative rounded-[16px] bg-gradient-to-br from-[#1a1030] via-[#1e1040] to-[#15102a] p-6 text-white">
            {/* Top section: Avatar + Info */}
            <div className="flex items-start gap-5">
              {/* Avatar — Clean Minimal */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                className="relative flex-shrink-0"
              >
                {data?.user?.equippedFrame?.imageUrl ? (
                  <AvatarWithFrame
                    photoUrl={photoUrl}
                    frameUrl={data.user.equippedFrame.imageUrl}
                    size={88}
                    fallbackLetter={avatarLetter}
                  />
                ) : (
                  <div className="relative h-[88px] w-[88px] rounded-full overflow-hidden ring-2 ring-white/30">
                    {photoUrl ? (
                      <img 
                        src={photoUrl} 
                        alt={displayName} 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-3xl font-bold bg-white/20 text-white backdrop-blur-sm">
                        {avatarLetter}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>

              {/* User info */}
              <div className="flex-1 pt-2">
                <motion.h2
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, ...spring }}
                  className="text-2xl font-black tracking-tight drop-shadow-lg"
                >
                  {displayName}
                </motion.h2>
                
                {data.user.username && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-1 text-sm text-white/70"
                  >
                    @{data.user.username}
                  </motion.p>
                )}
                
                {/* Profile 2.0: Status Badge */}
                {profile2Data?.status && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="mt-2"
                  >
                    <StatusBadge
                      status={profile2Data.status}
                      statusEmoji={profile2Data.statusEmoji}
                      statusText={profile2Data.statusText}
                      size="sm"
                    />
                  </motion.div>
                )}
                
                {/* Rank badges */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="mt-3 flex items-center gap-2"
                >
                  <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30">
                    <span className="mr-1">{rank.icon}</span>
                    {rank.label}
                  </Badge>
                  <Badge className="bg-amber-500/90 text-white border-0 font-mono shadow-lg">
                    Ур. {rank.level}
                  </Badge>
                </motion.div>
              </div>
              
              {/* Edit Profile Button (own profile only) */}
              {!isViewingOther && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    haptic.light();
                    setShowProfileEditor(true);
                  }}
                  className="absolute top-4 right-4 h-9 w-9 rounded-xl bg-white/20 hover:bg-white/30 text-white"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </Button>
              )}
            </div>
            
            {/* Profile 2.0: Bio */}
            {profile2Data?.bio && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="mt-4"
              >
                <ProfileBio bio={profile2Data.bio} />
              </motion.div>
            )}

            {/* XP Progress - Enhanced */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-6"
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-white/80 flex items-center gap-1.5 font-medium">
                  <span className="text-base">📈</span> Уровень {xp.level}
                </span>
                <span className="font-mono tabular-nums font-bold">{xp.xpInCurrentLevel} / {xp.xpNeededForNext} XP</span>
              </div>
              {/* Custom progress bar - Clean */}
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-white/60 mt-1.5 text-center font-medium">
                Всего: {(xp.total ?? 0).toLocaleString()} XP
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats Pills - Oval & Harmonious */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex justify-center gap-2.5 -mt-2"
      >
        {/* Score */}
        <div 
          className="flex items-center justify-center gap-1.5 rounded-full px-4 py-2 min-w-[100px]"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
            boxShadow: '0 3px 12px rgba(124, 58, 237, 0.3)',
          }}
        >
          <span className="text-base leading-none">💎</span>
          <span className="text-sm font-bold text-white tabular-nums leading-none">{animatedScore.toLocaleString()}</span>
          <span className="text-[10px] text-white/70 font-medium leading-none">очк.</span>
        </div>
        
        {/* Games */}
        <div 
          className="flex items-center justify-center gap-1.5 rounded-full px-4 py-2 min-w-[85px]"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
            boxShadow: '0 3px 12px rgba(16, 185, 129, 0.3)',
          }}
        >
          <span className="text-base leading-none">🎮</span>
          <span className="text-sm font-bold text-white tabular-nums leading-none">{animatedGames}</span>
          <span className="text-[10px] text-white/70 font-medium leading-none">игр</span>
        </div>
        
        {/* Rank */}
        <div 
          className="flex items-center justify-center gap-1.5 rounded-full px-4 py-2 min-w-[90px]"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
            boxShadow: '0 3px 12px rgba(245, 158, 11, 0.3)',
          }}
        >
          <span className="text-base leading-none">🏆</span>
          <span className="text-sm font-bold text-white tabular-nums leading-none">{data.stats.globalRank ?? "—"}</span>
          <span className="text-[10px] text-white/70 font-medium leading-none">место</span>
        </div>
      </motion.div>
      
      {/* Profile 2.0: Currently Playing */}
      {profile2Data?.currentlyPlaying && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <CurrentlyPlaying
            quizId={profile2Data.currentlyPlaying.quizId}
            quizTitle={profile2Data.currentlyPlaying.title}
            since={profile2Data.currentlyPlaying.since}
          />
        </motion.div>
      )}
      
      {/* Profile 2.0: Achievement Showcase */}
      {profile2Data?.showcaseAchievements && profile2Data.showcaseAchievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div 
            className="overflow-hidden rounded-2xl bg-white p-4"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
          >
            <AchievementShowcase achievementIds={profile2Data.showcaseAchievements} size="md" />
          </div>
        </motion.div>
      )}

      {/* Tabs — тёмный стиль как на главной */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Tabs value={activeTab} onValueChange={(v) => { haptic.selection(); setActiveTab(v); }} className="w-full">
          <div 
            className="overflow-hidden rounded-2xl bg-[#1a1a2e]/95 p-1.5"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
          >
            <TabsList className="w-full h-auto p-0 grid grid-cols-3 lg:grid-cols-5 gap-1 bg-transparent">
              <TabsTrigger 
                value="stats" 
                className="text-xs py-2.5 rounded-xl text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/30 font-semibold transition-all duration-200"
              >
                <span className="mr-1">📊</span> Стата
              </TabsTrigger>
              <TabsTrigger 
                value="achievements" 
                className="text-xs py-2.5 rounded-xl text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-amber-500/30 font-semibold transition-all duration-200"
              >
                <span className="mr-1">🏆</span> Ачивки
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="text-xs py-2.5 rounded-xl text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/30 font-semibold transition-all duration-200"
              >
                <span className="mr-1">🏅</span> Рекорды
              </TabsTrigger>
              {!isViewingOther && (
                <>
                  <TabsTrigger 
                    value="inventory" 
                    className="text-xs py-2.5 rounded-xl text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-rose-500/30 font-semibold transition-all duration-200"
                  >
                    <span className="mr-1">🎒</span> Инвент.
                  </TabsTrigger>
                  <TabsTrigger 
                    value="friends" 
                    className="text-xs py-2.5 rounded-xl text-white/60 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-cyan-500/30 font-semibold transition-all duration-200 relative"
                  >
                    <span className="mr-1">👥</span> Друзья
                    {incomingRequests.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1.5 text-[10px] font-bold text-white shadow-lg animate-bounce">
                        {incomingRequests.length}
                      </span>
                    )}
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-4 space-y-4">
            {/* Stats Grid - Dark Glassmorphism (only for own profile) */}
            {!isViewingOther && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
              style={{ boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)' }}
            >
              <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-violet-500/20 via-pink-500/15 to-amber-500/20 opacity-70" />
              <div className="relative rounded-[16px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: "🎮", label: "Игры", value: data.stats.totalQuizzesPlayed ?? 0, color: "from-violet-400 to-purple-500" },
                    { icon: "🎯", label: "Попытки", value: data.stats.totalSessions ?? 0, color: "from-rose-400 to-pink-500" },
                    { icon: "✅", label: "Верные", value: data.stats.totalCorrectAnswers ?? 0, color: "from-emerald-400 to-teal-500" },
                    { icon: "📊", label: "Точность", value: accuracy, suffix: "%", color: "from-amber-400 to-orange-500" },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * i }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-xl">
                        {stat.icon}
                      </div>
                      <div>
                        <p className={`text-xl font-black tabular-nums bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                          {stat.value}{stat.suffix}
                        </p>
                        <p className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">
                          {stat.label}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
            )}

            {/* Duel Stats - Dark Glassmorphism */}
            {data.stats.duelStats && data.stats.duelStats.total > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
                style={{ boxShadow: '0 8px 32px rgba(239, 68, 68, 0.15)' }}
              >
                <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-red-500/20 via-orange-500/15 to-yellow-500/20 opacity-70" />
                <div className="relative rounded-[16px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-600 shadow-lg shadow-red-500/25">
                      <span className="text-lg">⚔️</span>
                    </div>
                    <span className="font-bold text-white">Статистика дуэлей</span>
                    <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 text-white/70">
                      {data.stats.duelStats.total} игр
                    </span>
                  </div>
                  
                  {/* Main stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-3 rounded-xl bg-emerald-500/10">
                      <p className="text-2xl font-black tabular-nums text-emerald-400">{data.stats.duelStats.wins}</p>
                      <p className="text-[10px] text-white/50 font-medium uppercase">Побед</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-rose-500/10">
                      <p className="text-2xl font-black tabular-nums text-rose-400">{data.stats.duelStats.losses}</p>
                      <p className="text-[10px] text-white/50 font-medium uppercase">Поражений</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white/5">
                      <p className="text-2xl font-black tabular-nums text-white/70">{data.stats.duelStats.draws}</p>
                      <p className="text-[10px] text-white/50 font-medium uppercase">Ничьих</p>
                    </div>
                  </div>
                  
                  {/* Win rate bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-white/50 font-medium">Винрейт</span>
                      <span className="font-bold tabular-nums text-white">{data.stats.duelStats.winRate}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                      <motion.div 
                        className={`h-full rounded-full ${
                          data.stats.duelStats.winRate >= 60 
                            ? "bg-gradient-to-r from-emerald-500 to-green-500" 
                            : data.stats.duelStats.winRate >= 40 
                              ? "bg-gradient-to-r from-amber-500 to-yellow-500"
                              : "bg-gradient-to-r from-rose-500 to-red-500"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${data.stats.duelStats.winRate}%` }}
                        transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                  
                  {/* Streaks */}
                  <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🔥</span>
                      <div>
                        <p className="text-[10px] text-white/50 uppercase">Текущая серия</p>
                        <p className="font-bold tabular-nums text-amber-400">{data.stats.duelStats.currentStreak} {pluralize(data.stats.duelStats.currentStreak, ["победа", "победы", "побед"])}</p>
                      </div>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <div className="flex items-center gap-2">
                      <span className="text-xl">👑</span>
                      <div>
                        <p className="text-[10px] text-white/50 uppercase">Лучшая серия</p>
                        <p className="font-bold tabular-nums text-orange-400">{data.stats.duelStats.bestStreak} {pluralize(data.stats.duelStats.bestStreak, ["победа", "победы", "побед"])}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Last Game - Dark Glassmorphism (only for own profile) */}
            {!isViewingOther && data.stats.lastSession && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
                style={{ boxShadow: '0 8px 32px rgba(34, 211, 238, 0.15)' }}
              >
                <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-violet-500/20 opacity-70" />
                <div className="relative rounded-[16px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25">
                      <span className="text-lg">🎯</span>
                    </div>
                    <span className="font-bold text-white">Последняя игра</span>
                  </div>
                  <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-white/5">
                    <div>
                      <p className="font-bold text-white">{data.stats.lastSession.quizTitle}</p>
                      <p className="text-xs text-white/50">{formatDate(data.stats.lastSession.finishedAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black tabular-nums bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">{data.stats.lastSession.score}</p>
                      <p className="text-[10px] text-white/50 uppercase font-medium">очков</p>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-lg shadow-violet-500/30 flex items-center justify-center gap-2"
                    onClick={() => router.push(`/miniapp/quiz/${data.stats.lastSession?.quizId}`)}
                  >
                    <span>▶</span> Играть снова
                  </motion.button>
                </div>
              </motion.div>
            )}
            
            {/* Public Profile Stats Summary - Dark Glassmorphism */}
            {isViewingOther && (
              <div className="space-y-4">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
                  style={{ boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)' }}
                >
                  <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-violet-500/20 via-purple-500/15 to-pink-500/20 opacity-70" />
                  <div className="relative rounded-[16px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-6">
                    <div className="flex items-center justify-center gap-8">
                      <div className="text-center">
                        <p className="text-4xl font-black tabular-nums bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                          {data.stats.totalScore}
                        </p>
                        <p className="text-sm text-white/50 font-medium mt-1">Общий счёт</p>
                      </div>
                      {data.stats.globalRank && (
                        <div className="text-center border-l border-white/10 pl-8">
                          <p className="text-4xl font-black tabular-nums bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                            #{data.stats.globalRank}
                          </p>
                          <p className="text-sm text-white/50 font-medium mt-1">
                            из {data.stats.totalPlayers}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
                
                {/* Public Profile Duel Stats */}
                {data.stats.duelStats && data.stats.duelStats.total > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
                    style={{ boxShadow: '0 8px 32px rgba(239, 68, 68, 0.15)' }}
                  >
                    <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-red-500/20 via-orange-500/15 to-yellow-500/20 opacity-70" />
                    <div className="relative rounded-[16px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">⚔️</span>
                        <span className="font-bold text-white">Дуэли</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 rounded-xl bg-emerald-500/10">
                          <p className="text-lg font-bold tabular-nums text-emerald-400">{data.stats.duelStats.wins}</p>
                          <p className="text-[10px] text-white/50">Побед</p>
                        </div>
                        <div className="p-2 rounded-xl bg-rose-500/10">
                          <p className="text-lg font-bold tabular-nums text-rose-400">{data.stats.duelStats.losses}</p>
                          <p className="text-[10px] text-white/50">Поражений</p>
                        </div>
                        <div className="p-2 rounded-xl bg-white/5">
                          <p className="text-lg font-bold tabular-nums text-white">{data.stats.duelStats.winRate}%</p>
                          <p className="text-[10px] text-white/50">Винрейт</p>
                        </div>
                        <div className="p-2 rounded-xl bg-amber-500/10">
                          <p className="text-lg font-bold tabular-nums text-amber-400">{data.stats.duelStats.bestStreak}</p>
                          <p className="text-[10px] text-white/50">🔥 Макс</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="mt-4 space-y-4">
            <ReferralSection />
            <LazyAchievementsSection onXpEarned={() => loadAllData()} />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            {isViewingOther ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
              >
                <div className="relative rounded-[16px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] py-12 text-center">
                  <span className="text-5xl">🔒</span>
                  <p className="mt-4 text-white/50">История недоступна для просмотра</p>
                </div>
              </motion.div>
            ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
              style={{ boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)' }}
            >
              <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-pink-500/20 opacity-70" />
              <div className="relative rounded-[16px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
                      <span className="text-lg">🏆</span>
                    </div>
                    <span className="font-bold text-white">Лучшие результаты</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 text-white/70">
                    {(data.stats.bestScoreByQuiz ?? []).length} игр
                  </span>
                </div>
                
                {(data.stats.bestScoreByQuiz ?? []).length === 0 ? (
                  <div className="flex flex-col items-center py-8">
                    <span className="text-5xl animate-bounce">📊</span>
                    <p className="mt-4 font-semibold text-white">Пока нет рекордов</p>
                    <p className="mt-2 text-sm text-white/50">Пройди свою первую викторину!</p>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => router.push("/miniapp")}
                      className="mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-lg shadow-violet-500/30"
                    >
                      К викторинам →
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(data.stats.bestScoreByQuiz ?? []).map((item, i) => (
                      <motion.button
                        key={item.quizId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                        onClick={() => router.push(`/miniapp/quiz/${item.quizId}`)}
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
                          i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/25" :
                          i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400 shadow-lg" :
                          i === 2 ? "bg-gradient-to-br from-orange-400 to-amber-600 shadow-lg shadow-orange-500/25" :
                          "bg-white/10"
                        }`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-sm font-bold text-white">{i + 1}</span>}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="truncate font-semibold text-white">{item.title}</p>
                          <p className="text-xs text-white/50">
                            {item.attempts} {item.attempts === 1 ? "попытка" : item.attempts < 5 ? "попытки" : "попыток"}
                          </p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-xl font-black tabular-nums text-white">{item.leaderboardScore}</p>
                          {item.bestSessionScore !== item.leaderboardScore && (
                            <p className="text-[10px] text-white/50">рекорд: {item.bestSessionScore}</p>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
            )}
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="mt-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
              style={{ boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)' }}
            >
              <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-violet-500/20 via-pink-500/15 to-cyan-500/20 opacity-70" />
              <div className="relative rounded-[16px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4">
                <InventorySection photoUrl={photoUrl} firstName={data.user.firstName} />
              </div>
            </motion.div>
          </TabsContent>

          {/* Friends Tab */}
          <TabsContent value="friends" className="mt-4 space-y-4">
            {/* Recent Opponents Section */}
            <LazyRecentOpponents className="mb-4" />

            {/* Add Friend Button - Dark Glassmorphism */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-lg shadow-violet-500/30 flex items-center justify-center gap-2"
              onClick={() => {
                haptic.medium();
                setShowAddFriend(true);
              }}
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Добавить друга
            </motion.button>

            {friendsLoading ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-4"
              >
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 animate-pulse">
                      <div className="h-10 w-10 rounded-full bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 rounded bg-white/10" />
                        <div className="h-3 w-16 rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <>
                {/* Incoming Requests - Dark Glassmorphism */}
                {incomingRequests.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
                    style={{ boxShadow: '0 8px 32px rgba(139, 92, 246, 0.2)' }}
                  >
                    <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-violet-500/30 via-purple-500/20 to-pink-500/30 opacity-70 animate-pulse" />
                    <div className="relative rounded-[16px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                          <span className="text-lg">👥</span>
                        </div>
                        <span className="font-bold text-white">Заявки в друзья</span>
                        <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 text-white">{incomingRequests.length}</span>
                      </div>
                      <div className="space-y-2">
                        {incomingRequests.map((req) => {
                          const reqName = req.firstName ?? req.username ?? "Пользователь";
                          return (
                            <div key={req.requestId} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={req.photoUrl ?? undefined} />
                                <AvatarFallback className="bg-white/20 text-white">{reqName[0].toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate text-white">{reqName}</p>
                                {req.username && <p className="text-xs text-white/50">@{req.username}</p>}
                              </div>
                              <div className="flex gap-2">
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  className="h-8 w-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center"
                                  onClick={() => {
                                    haptic.success();
                                    handleRespondRequest(req.requestId, "accept");
                                  }}
                                >
                                  ✓
                                </motion.button>
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  className="h-8 w-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center"
                                  onClick={() => {
                                    haptic.light();
                                    handleRespondRequest(req.requestId, "decline");
                                  }}
                                >
                                  ✕
                                </motion.button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Outgoing Requests - Dark Glassmorphism */}
                {outgoingRequests.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
                  >
                    <div className="relative rounded-[16px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                          <span className="text-lg">📤</span>
                        </div>
                        <span className="font-bold text-white">Отправленные заявки</span>
                      </div>
                      <div className="space-y-2">
                        {outgoingRequests.map((req) => {
                          const reqName = req.firstName ?? req.username ?? "Пользователь";
                          return (
                            <div key={req.requestId} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={req.photoUrl ?? undefined} />
                                <AvatarFallback className="bg-white/20 text-white">{reqName[0].toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate text-white">{reqName}</p>
                                <p className="text-xs text-white/50">Ожидает подтверждения...</p>
                              </div>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                                onClick={() => {
                                  haptic.light();
                                  handleCancelRequest(req.requestId);
                                }}
                              >
                                Отменить
                              </motion.button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Friends List - Dark Glassmorphism */}
                {friends.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
                  >
                    <div className="relative rounded-[16px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] py-12 text-center">
                      <span className="text-5xl block mx-auto mb-4">👥</span>
                      <p className="font-semibold text-white">Пока нет друзей</p>
                      <p className="text-sm text-white/50 mt-2">
                        Отправь заявку по username,<br />друг получит уведомление
                      </p>
                    </div>
                  </motion.div>
                ) : friends.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0f0f1a]/98 to-[#1a1a2e]/98 p-1"
                    style={{ boxShadow: '0 8px 32px rgba(34, 211, 238, 0.15)' }}
                  >
                    <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-violet-500/20 opacity-70" />
                    <div className="relative rounded-[16px] bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25">
                          <span className="text-lg">👥</span>
                        </div>
                        <span className="font-bold text-white">Мои друзья</span>
                        <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 text-white">{friends.length}</span>
                      </div>
                      <div className="space-y-3">
                      {friends.map((friend, i) => {
                        const friendName = friend.firstName ?? friend.username ?? "Друг";
                        const friendRank = getRank(friend.stats.totalScore);
                        
                        return (
                          <motion.div
                            key={friend.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-xl bg-white/5 p-3 space-y-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className={`absolute -inset-0.5 rounded-full bg-gradient-to-r ${friendRank.color} opacity-60`} />
                                <Avatar className="relative h-12 w-12">
                                  <AvatarImage src={friend.photoUrl ?? undefined} />
                                  <AvatarFallback className="bg-white/20 text-white">{friendName[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate text-white">{friendName}</p>
                                {friend.username && (
                                  <p className="text-xs text-white/50">@{friend.username}</p>
                                )}
                              </div>
                              
                              <div className={`px-2 py-1 rounded-lg bg-gradient-to-r ${friendRank.color} text-white text-xs font-bold`}>
                                <span className="mr-1">{friendRank.icon}</span>
                                {friendRank.level}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                              <div className="text-center flex-1">
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-lg">💎</span>
                                  <p className="font-bold tabular-nums text-white">{friend.stats.totalScore}</p>
                                </div>
                                <p className="text-[10px] text-white/50">очков</p>
                              </div>
                              <div className="h-8 w-px bg-white/10" />
                              <div className="text-center flex-1">
                                <p className="font-bold tabular-nums text-white">{friend.stats.gamesPlayed}</p>
                                <p className="text-[10px] text-white/50">игр</p>
                              </div>
                              <div className="h-8 w-px bg-white/10" />
                              <div className="text-center flex-1">
                                <p className="font-bold tabular-nums text-white">{friend.stats.bestScore}</p>
                                <p className="text-[10px] text-white/50">рекорд</p>
                              </div>
                            </div>
                            
                            <motion.button
                              whileTap={{ scale: 0.98 }}
                              className="w-full py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-sm font-medium transition-colors"
                              onClick={() => {
                                haptic.warning();
                                handleRemoveFriend(friend.friendshipId);
                              }}
                            >
                              Удалить из друзей
                            </motion.button>
                          </motion.div>
                        );
                      })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Add Friend Dialog - Dark Glassmorphism */}
      <Dialog open={showAddFriend} onOpenChange={setShowAddFriend}>
        <DialogContent className="sm:max-w-sm border-0 bg-gradient-to-br from-[#0f0f1a] to-[#1a1a2e] text-white">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
              <span className="text-3xl">👥</span>
            </div>
            <DialogTitle className="text-center text-white">Добавить друга</DialogTitle>
            <DialogDescription className="text-center text-white/60">
              Введи username друга в Telegram
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Input
                type="text"
                value={friendUsername}
                onChange={(e) => {
                  setFriendUsername(e.target.value);
                  setAddFriendError(null);
                }}
                placeholder="@username"
                className="text-center bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              {addFriendError && (
                <p className="mt-2 text-sm text-rose-400 text-center">{addFriendError}</p>
              )}
              {addFriendSuccess && (
                <p className="mt-2 text-sm text-emerald-400 font-semibold text-center">{addFriendSuccess}</p>
              )}
            </div>
            
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                onClick={() => {
                  haptic.light();
                  setShowAddFriend(false);
                  setFriendUsername("");
                  setAddFriendError(null);
                  setAddFriendSuccess(null);
                }}
              >
                Отмена
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-lg shadow-violet-500/30 disabled:opacity-50"
                onClick={() => {
                  haptic.medium();
                  handleAddFriend();
                }}
                disabled={addingFriend || !friendUsername.trim()}
              >
                {addingFriend ? "Добавляем..." : "Добавить"}
              </motion.button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile 2.0 Editor Dialog */}
      {profile2Data && !isViewingOther && (
        <LazyProfileEditor
          open={showProfileEditor}
          onOpenChange={setShowProfileEditor}
          initialData={{
            bio: profile2Data.bio,
            status: profile2Data.status,
            statusEmoji: profile2Data.statusEmoji,
            statusText: profile2Data.statusText,
            showcaseAchievements: profile2Data.showcaseAchievements,
            privacy: profile2Data.privacy || {
              profilePublic: true,
              showActivity: true,
              showOnlineStatus: true,
            },
          }}
          unlockedAchievements={profile2Data.unlockedAchievements}
          presetStatuses={profile2Data.presetStatuses}
          onSave={loadAllData}
        />
      )}

      {/* Notification Settings - Enhanced */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        <Card className="overflow-hidden border-0 shadow-[0_8px_30px_rgb(0,0,0,0.1)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
          <div className="h-1.5 bg-gradient-to-r from-rose-500 via-pink-500 to-purple-500" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg">
                <span className="text-lg">🔔</span>
              </div>
              <span className="font-bold">Уведомления</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <NotificationToggle
              label="Level Up"
              description="Когда достигаешь нового уровня"
              icon={<span className="text-xl">👑</span>}
              enabled={notifySettings.notifyLevelUp}
              onChange={(v) => updateNotifySetting("notifyLevelUp", v)}
            />
            <NotificationToggle
              label="Энергия"
              description="Когда энергия восстановлена"
              icon={<span className="text-xl">⚡</span>}
              enabled={notifySettings.notifyEnergyFull}
              onChange={(v) => updateNotifySetting("notifyEnergyFull", v)}
            />
            <NotificationToggle
              label="Напоминания"
              description="Ежедневные напоминания об игре"
              icon={<span className="text-xl">📅</span>}
              enabled={notifySettings.notifyDailyReminder}
              onChange={(v) => updateNotifySetting("notifyDailyReminder", v)}
            />
            <NotificationToggle
              label="Друзья"
              description="Активность друзей"
              icon={<span className="text-xl">👥</span>}
              enabled={notifySettings.notifyFriends}
              onChange={(v) => updateNotifySetting("notifyFriends", v)}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Help & Tutorial Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.58 }}
      >
        <Card className="overflow-hidden border-0 shadow-[0_8px_30px_rgb(0,0,0,0.1)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
          <div className="h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg">
                <span className="text-lg">❓</span>
              </div>
              <span className="font-bold">Помощь</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl border-2 font-semibold hover:bg-cyan-50 hover:border-cyan-300 transition-all"
              onClick={() => {
                haptic.medium();
                resetTour();
                router.push("/miniapp");
              }}
            >
              <span className="text-xl mr-2">🎓</span>
              Пройти обучение заново
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button
          variant="outline"
          size="lg"
          className="w-full h-14 rounded-2xl border-2 font-bold shadow-sm hover:shadow-md transition-all hover:bg-muted/50"
          onClick={() => {
            haptic.light();
            router.push("/miniapp");
          }}
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          На главную
        </Button>
      </motion.div>
    </div>
    </PullToRefresh>
  );
}
