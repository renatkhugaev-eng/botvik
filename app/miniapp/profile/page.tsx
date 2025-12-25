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
import { AchievementsSection } from "@/components/AchievementsSection";
import { ReferralSection } from "@/components/ReferralSection";
import { AvatarWithFrame } from "@/components/AvatarWithFrame";
import { InventorySection } from "@/components/InventorySection";

// Profile 2.0 Components
import { ProfileEditor } from "@/components/ProfileEditor";
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
      await fetch("/api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
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
    <div className={`relative flex flex-col gap-6 min-h-screen bg-gradient-to-b from-violet-50/50 via-background to-background dark:from-violet-950/20 px-4 pt-3 pb-24 w-full overflow-x-hidden ${isScrolling && !isIOS ? "perf" : ""}`}>
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="relative z-20 flex items-center justify-between py-3"
      >
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            haptic.light();
            router.back();
          }}
          className="h-11 w-11 rounded-2xl border-2 shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition-all duration-200 bg-white/80 backdrop-blur-sm"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Button>
        
        <Badge className="rounded-full px-5 py-2.5 text-sm font-bold bg-white/90 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.1)] border-0 text-foreground">
          <div className={`h-2.5 w-2.5 rounded-full ${isViewingOther ? "bg-blue-500" : "bg-gradient-to-r from-violet-500 to-purple-500"} animate-pulse mr-2`} />
          {isViewingOther ? `👤 ${displayName}` : "Профиль"}
        </Badge>
        
        <div className="flex items-center gap-2">
          {!isViewingOther && (
            <Button
              variant="default"
              size="icon"
              onClick={() => {
                haptic.medium();
                router.push("/miniapp/shop");
              }}
              className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 shadow-[0_8px_20px_-4px_rgba(251,146,60,0.5)] hover:shadow-[0_12px_28px_-4px_rgba(251,146,60,0.6)] border-0 transition-all duration-200"
            >
              <span className="text-lg">🛒</span>
            </Button>
          )}
          
          {!isViewingOther && data.user.telegramId === "5731136459" && (
            <Button
              variant="default"
              size="icon"
              onClick={() => {
                haptic.medium();
                window.open("/admin", "_blank");
              }}
              className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-[0_8px_20px_-4px_rgba(139,92,246,0.5)] hover:shadow-[0_12px_28px_-4px_rgba(139,92,246,0.6)] border-0 transition-all duration-200"
            >
              <span className="text-lg">⚙️</span>
            </Button>
          )}
        </div>
      </motion.header>

      {/* Hero Section - Gradient Background */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...smoothSpring, delay: 0.1 }}
        className="relative"
      >
        {/* Animated gradient background */}
        <div className="absolute -inset-4 -top-20 bg-gradient-to-br from-violet-600/30 via-purple-500/20 to-fuchsia-500/30 blur-3xl opacity-60 pointer-events-none" />
        
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 shadow-[0_20px_70px_-15px_rgba(139,92,246,0.5)] dark:shadow-[0_20px_70px_-15px_rgba(139,92,246,0.3)]">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          
          <CardContent className="relative p-6 text-white">
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
                  <div className="relative h-[88px] w-[88px] rounded-2xl overflow-hidden ring-2 ring-white/30">
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
              {/* Custom progress bar */}
              <div className="h-4 rounded-full bg-white/20 backdrop-blur-sm overflow-hidden shadow-inner">
                <motion.div 
                  className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 rounded-full shadow-lg relative"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
                  <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-r from-transparent to-white/50 animate-pulse" />
                </motion.div>
              </div>
              <p className="text-xs text-white/60 mt-1.5 text-center font-medium">
                Всего: {(xp.total ?? 0).toLocaleString()} XP
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Score Card - Glass morphism */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
      >
        <Card className="overflow-hidden border-0 bg-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <motion.span 
                    className="text-3xl"
                    animate={{ rotate: [0, -10, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    💎
                  </motion.span>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Всего очков</p>
                </div>
                <p className="text-5xl font-black tracking-tighter tabular-nums bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                  {animatedScore.toLocaleString()}
                </p>
              </div>
              
              {/* Mini stats */}
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold tabular-nums text-violet-600">{animatedGames}</p>
                  <p className="text-xs text-muted-foreground font-medium">игр</p>
                </div>
                <div className="h-10 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
                <div className="text-center">
                  <p className="text-2xl font-bold tabular-nums text-emerald-600">{animatedCorrect}</p>
                  <p className="text-xs text-muted-foreground font-medium">верных</p>
                </div>
              </div>
            </div>
            
            {/* Global Rank */}
            {globalRankText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30"
              >
                <span className="text-xl">🏆</span>
                <span className="text-sm text-muted-foreground font-medium">
                  Место в рейтинге:
                </span>
                <Badge className={`${data.stats.globalRank && data.stats.globalRank <= 3 
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0" 
                  : ""}`}
                >
                  {globalRankText}
                </Badge>
              </motion.div>
            )}
          </CardContent>
        </Card>
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
          <Card className="overflow-hidden border-0 bg-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <CardContent className="p-4">
              <AchievementShowcase achievementIds={profile2Data.showcaseAchievements} size="md" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Tabs value={activeTab} onValueChange={(v) => { haptic.selection(); setActiveTab(v); }} className="w-full">
          <TabsList className="w-full h-auto p-1.5 grid grid-cols-3 lg:grid-cols-5 gap-1 bg-muted/60 backdrop-blur-sm rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]">
            <TabsTrigger 
              value="stats" 
              className="text-xs py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-[0_4px_12px_rgba(0,0,0,0.1)] data-[state=active]:text-violet-600 font-semibold transition-all duration-200"
            >
              <span className="mr-1">📊</span> Стата
            </TabsTrigger>
            <TabsTrigger 
              value="achievements" 
              className="text-xs py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-[0_4px_12px_rgba(0,0,0,0.1)] data-[state=active]:text-amber-600 font-semibold transition-all duration-200"
            >
              <span className="mr-1">🏆</span> Ачивки
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="text-xs py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-[0_4px_12px_rgba(0,0,0,0.1)] data-[state=active]:text-emerald-600 font-semibold transition-all duration-200"
            >
              <span className="mr-1">🏅</span> Рекорды
            </TabsTrigger>
            {!isViewingOther && (
              <>
                <TabsTrigger 
                  value="inventory" 
                  className="text-xs py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-[0_4px_12px_rgba(0,0,0,0.1)] data-[state=active]:text-rose-600 font-semibold transition-all duration-200"
                >
                  <span className="mr-1">🎒</span> Инвент.
                </TabsTrigger>
                <TabsTrigger 
                  value="friends" 
                  className="text-xs py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-[0_4px_12px_rgba(0,0,0,0.1)] data-[state=active]:text-blue-600 font-semibold transition-all duration-200 relative"
                >
                  <span className="mr-1">👥</span> Друзья
                  {incomingRequests.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1.5 text-[10px] font-bold text-white shadow-[0_4px_12px_rgba(244,63,94,0.4)] animate-bounce">
                      {incomingRequests.length}
                    </span>
                  )}
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-4 space-y-4">
            {/* Stats Grid - Colorful (only for own profile) */}
            {!isViewingOther && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: "🎮", label: "Игры", value: data.stats.totalQuizzesPlayed ?? 0, gradient: "from-violet-500 to-purple-600", bg: "bg-violet-500/10" },
                { icon: "🎯", label: "Попытки", value: data.stats.totalSessions ?? 0, gradient: "from-rose-500 to-pink-600", bg: "bg-rose-500/10" },
                { icon: "✅", label: "Верные", value: data.stats.totalCorrectAnswers ?? 0, gradient: "from-emerald-500 to-teal-600", bg: "bg-emerald-500/10" },
                { icon: "📊", label: "Точность", value: accuracy, suffix: "%", gradient: "from-amber-500 to-orange-600", bg: "bg-amber-500/10" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.1 * i, ...spring }}
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card className="overflow-hidden border-0 shadow-[0_4px_20px_rgb(0,0,0,0.08)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.15)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.4)] transition-all duration-300 cursor-default">
                    {/* Gradient accent top */}
                    <div className={`h-1.5 bg-gradient-to-r ${stat.gradient}`} />
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg} text-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]`}>
                          {stat.icon}
                        </div>
                        <div>
                          <p className={`text-2xl font-black tabular-nums bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent drop-shadow-sm`}>
                            {stat.value}{stat.suffix}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                            {stat.label}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
            )}

            {/* Last Game - Enhanced (only for own profile) */}
            {!isViewingOther && data.stats.lastSession && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="overflow-hidden border-0 shadow-[0_8px_30px_rgb(0,0,0,0.1)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
                  <div className="h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500" />
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg">
                        <span className="text-sm">🎯</span>
                      </div>
                      <span className="font-bold">Последняя игра</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-muted/50">
                      <div>
                        <p className="font-bold">{data.stats.lastSession.quizTitle}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(data.stats.lastSession.finishedAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black tabular-nums bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">{data.stats.lastSession.score}</p>
                        <p className="text-xs text-muted-foreground font-medium">очков</p>
                      </div>
                    </div>
                    <Button
                      className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-[0_8px_25px_-5px_rgba(139,92,246,0.5)] hover:shadow-[0_12px_35px_-5px_rgba(139,92,246,0.6)] font-bold transition-all duration-300"
                      onClick={() => router.push(`/miniapp/quiz/${data.stats.lastSession?.quizId}`)}
                    >
                      <span className="mr-2">▶</span> Играть снова
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            
            {/* Public Profile Stats Summary */}
            {isViewingOther && (
              <Card className="overflow-hidden border-0 shadow-lg">
                <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-600" />
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center gap-6">
                    <div>
                      <p className="text-4xl font-black tabular-nums bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                        {data.stats.totalScore}
                      </p>
                      <p className="text-sm text-muted-foreground font-medium mt-1">Общий счёт</p>
                    </div>
                    {data.stats.globalRank && (
                      <div className="border-l pl-6">
                        <p className="text-4xl font-black tabular-nums bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                          #{data.stats.globalRank}
                        </p>
                        <p className="text-sm text-muted-foreground font-medium mt-1">
                          из {data.stats.totalPlayers}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="mt-4 space-y-4">
            <ReferralSection />
            <AchievementsSection onXpEarned={() => loadAllData()} />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            {isViewingOther ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <span className="text-5xl">🔒</span>
                  <p className="mt-4 text-muted-foreground">История недоступна для просмотра</p>
                </CardContent>
              </Card>
            ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">🏆</span>
                    Лучшие результаты
                  </CardTitle>
                  <Badge variant="secondary">
                    {(data.stats.bestScoreByQuiz ?? []).length} игр
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {(data.stats.bestScoreByQuiz ?? []).length === 0 ? (
                  <div className="flex flex-col items-center py-12">
                    <span className="text-6xl animate-bounce">📊</span>
                    <p className="mt-6 font-semibold">Пока нет рекордов</p>
                    <p className="mt-2 text-sm text-muted-foreground">Пройди свою первую викторину!</p>
                    <Button
                      onClick={() => router.push("/miniapp")}
                      className="mt-6"
                    >
                      К викторинам →
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(data.stats.bestScoreByQuiz ?? []).map((item, i) => (
                      <motion.div
                        key={item.quizId}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08, ...spring }}
                      >
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-auto p-4 hover:bg-muted"
                          onClick={() => router.push(`/miniapp/quiz/${item.quizId}`)}
                        >
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg mr-3 ${
                            i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500" :
                            i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400" :
                            i === 2 ? "bg-gradient-to-br from-orange-400 to-amber-600" :
                            "bg-muted"
                          }`}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-sm font-bold">{i + 1}</span>}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="truncate font-semibold">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.attempts} {item.attempts === 1 ? "попытка" : item.attempts < 5 ? "попытки" : "попыток"}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-xl font-black tabular-nums">{item.leaderboardScore}</p>
                            {item.bestSessionScore !== item.leaderboardScore && (
                              <p className="text-[10px] text-muted-foreground">рекорд: {item.bestSessionScore}</p>
                            )}
                          </div>
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            )}
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <InventorySection photoUrl={photoUrl} firstName={data.user.firstName} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Friends Tab */}
          <TabsContent value="friends" className="mt-4 space-y-4">
            {/* Add Friend Button */}
            <Button
              className="w-full h-14"
              onClick={() => {
                haptic.medium();
                setShowAddFriend(true);
              }}
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Добавить друга
            </Button>

            {friendsLoading ? (
              <Card>
                <CardContent className="divide-y">
                  {[0, 1, 2].map((i) => (
                    <SkeletonFriendCard key={i} index={i} />
                  ))}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Incoming Requests */}
                {incomingRequests.length > 0 && (
                  <Card className="bg-gradient-to-br from-primary to-purple-600 text-white border-0">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-white">
                        <span className="text-xl">👥</span>
                        Заявки в друзья
                        <Badge variant="secondary" className="ml-auto">{incomingRequests.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {incomingRequests.map((req) => {
                        const reqName = req.firstName ?? req.username ?? "Пользователь";
                        return (
                          <div key={req.requestId} className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={req.photoUrl ?? undefined} />
                              <AvatarFallback className="bg-white/20 text-white">{reqName[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{reqName}</p>
                              {req.username && <p className="text-xs opacity-60">@{req.username}</p>}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 bg-emerald-500 hover:bg-emerald-600 text-white"
                                onClick={() => {
                                  haptic.success();
                                  handleRespondRequest(req.requestId, "accept");
                                }}
                              >
                                ✓
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 bg-white/20 hover:bg-white/30 text-white"
                                onClick={() => {
                                  haptic.light();
                                  handleRespondRequest(req.requestId, "decline");
                                }}
                              >
                                ✕
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Outgoing Requests */}
                {outgoingRequests.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="text-lg">📤</span>
                        Отправленные заявки
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {outgoingRequests.map((req) => {
                        const reqName = req.firstName ?? req.username ?? "Пользователь";
                        return (
                          <div key={req.requestId} className="flex items-center gap-3 rounded-xl bg-muted p-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={req.photoUrl ?? undefined} />
                              <AvatarFallback>{reqName[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{reqName}</p>
                              <p className="text-xs text-muted-foreground">Ожидает подтверждения...</p>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                haptic.light();
                                handleCancelRequest(req.requestId);
                              }}
                            >
                              Отменить
                            </Button>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Friends List */}
                {friends.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <span className="text-5xl block mx-auto mb-4">👥</span>
                      <p className="font-semibold">Пока нет друзей</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Отправь заявку по username,<br />друг получит уведомление
                      </p>
                    </CardContent>
                  </Card>
                ) : friends.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="text-xl">👥</span>
                        Мои друзья ({friends.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {friends.map((friend, i) => {
                        const friendName = friend.firstName ?? friend.username ?? "Друг";
                        const friendRank = getRank(friend.stats.totalScore);
                        
                        return (
                          <motion.div
                            key={friend.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05, ...spring }}
                            className="space-y-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className={`absolute -inset-0.5 rounded-full bg-gradient-to-r ${friendRank.color} opacity-60`} />
                                <Avatar className="relative h-12 w-12">
                                  <AvatarImage src={friend.photoUrl ?? undefined} />
                                  <AvatarFallback>{friendName[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{friendName}</p>
                                {friend.username && (
                                  <p className="text-xs text-muted-foreground">@{friend.username}</p>
                                )}
                              </div>
                              
                              <Badge className={`bg-gradient-to-r ${friendRank.color} text-white border-0`}>
                                <span className="mr-1">{friendRank.icon}</span>
                                {friendRank.level}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center justify-between rounded-xl bg-muted p-3">
                              <div className="text-center flex-1">
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-xl">💎</span>
                                  <p className="font-bold tabular-nums">{friend.stats.totalScore}</p>
                                </div>
                                <p className="text-[10px] text-muted-foreground">очков</p>
                              </div>
                              <div className="h-8 w-px bg-border" />
                              <div className="text-center flex-1">
                                <p className="font-bold tabular-nums">{friend.stats.gamesPlayed}</p>
                                <p className="text-[10px] text-muted-foreground">игр</p>
                              </div>
                              <div className="h-8 w-px bg-border" />
                              <div className="text-center flex-1">
                                <p className="font-bold tabular-nums">{friend.stats.bestScore}</p>
                                <p className="text-[10px] text-muted-foreground">рекорд</p>
                              </div>
                            </div>
                            
                            <Button
                              variant="destructive"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                haptic.warning();
                                handleRemoveFriend(friend.friendshipId);
                              }}
                            >
                              Удалить из друзей
                            </Button>
                          </motion.div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Add Friend Dialog */}
      <Dialog open={showAddFriend} onOpenChange={setShowAddFriend}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600">
              <span className="text-3xl">👥</span>
            </div>
            <DialogTitle className="text-center">Добавить друга</DialogTitle>
            <DialogDescription className="text-center">
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
                className="text-center"
              />
              {addFriendError && (
                <p className="mt-2 text-sm text-destructive text-center">{addFriendError}</p>
              )}
              {addFriendSuccess && (
                <p className="mt-2 text-sm text-emerald-500 font-semibold text-center">{addFriendSuccess}</p>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  haptic.light();
                  setShowAddFriend(false);
                  setFriendUsername("");
                  setAddFriendError(null);
                  setAddFriendSuccess(null);
                }}
              >
                Отмена
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  haptic.medium();
                  handleAddFriend();
                }}
                disabled={addingFriend || !friendUsername.trim()}
              >
                {addingFriend ? "Добавляем..." : "Добавить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile 2.0 Editor Dialog */}
      {profile2Data && !isViewingOther && (
        <ProfileEditor
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
