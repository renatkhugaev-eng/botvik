"use client";

import { motion } from "framer-motion";

// Base shimmer animation
const shimmer = {
  initial: { x: "-100%" },
  animate: { x: "100%" },
  transition: { 
    repeat: Infinity, 
    duration: 1.5, 
    ease: "easeInOut",
    repeatDelay: 0.5 
  },
};

// Base skeleton component
type SkeletonProps = {
  className?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
};

export function Skeleton({ className = "", rounded = "lg" }: SkeletonProps) {
  const roundedClass = {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  }[rounded];

  return (
    <div className={`relative overflow-hidden bg-slate-200 ${roundedClass} ${className}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
        {...shimmer}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PRE-BUILT SKELETON COMPOSITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Skeleton for quiz cards in carousel
 */
export function SkeletonQuizCard() {
  return (
    <div className="flex h-[200px] w-[168px] flex-shrink-0 flex-col rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      {/* Icon + Badge */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-8" rounded="lg" />
        <Skeleton className="h-5 w-16" rounded="full" />
      </div>
      {/* Title */}
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-2 h-4 w-full" />
      {/* Description */}
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-1 h-3 w-2/3" />
      {/* Button */}
      <Skeleton className="mt-auto h-9 w-full" rounded="xl" />
    </div>
  );
}

/**
 * Skeleton for user profile header
 */
export function SkeletonProfileHeader() {
  return (
    <div className="flex items-center gap-4 py-4">
      {/* Avatar */}
      <Skeleton className="h-14 w-14" rounded="full" />
      {/* Text */}
      <div className="flex-1">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-4 w-24" />
      </div>
      {/* Stats */}
      <div className="flex gap-3">
        <div className="text-center">
          <Skeleton className="mx-auto h-5 w-8" />
          <Skeleton className="mt-1 h-3 w-10" />
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div className="text-center">
          <Skeleton className="mx-auto h-5 w-8" />
          <Skeleton className="mt-1 h-3 w-10" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for leaderboard entry
 */
export function SkeletonLeaderboardEntry({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-lg shadow-black/5"
    >
      {/* Position */}
      <Skeleton className="h-10 w-10" rounded="full" />
      {/* Avatar */}
      <Skeleton className="h-12 w-12" rounded="full" />
      {/* Name */}
      <div className="flex-1">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-1 h-3 w-16" />
      </div>
      {/* Score */}
      <Skeleton className="h-6 w-16" />
    </motion.div>
  );
}

/**
 * Skeleton for friend card
 */
export function SkeletonFriendCard({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="p-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-12 w-12" rounded="full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-1 h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-14" rounded="full" />
      </div>
      {/* Stats */}
      <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
        <div className="text-center flex-1">
          <Skeleton className="mx-auto h-5 w-10" />
          <Skeleton className="mx-auto mt-1 h-3 w-12" />
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div className="text-center flex-1">
          <Skeleton className="mx-auto h-5 w-10" />
          <Skeleton className="mx-auto mt-1 h-3 w-8" />
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div className="text-center flex-1">
          <Skeleton className="mx-auto h-5 w-10" />
          <Skeleton className="mx-auto mt-1 h-3 w-12" />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Skeleton for stat card
 */
export function SkeletonStatCard() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-lg shadow-black/5">
      <Skeleton className="h-4 w-20 mb-3" />
      <Skeleton className="h-10 w-24" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

/**
 * Skeleton for podium (top 3)
 */
export function SkeletonPodium() {
  return (
    <div className="flex items-end justify-center gap-2 py-4">
      {/* 2nd place */}
      <div className="flex flex-col items-center">
        <Skeleton className="h-16 w-16 mb-2" rounded="full" />
        <Skeleton className="h-4 w-16 mb-1" />
        <Skeleton className="h-5 w-12" />
        <div className="mt-2 h-20 w-20 rounded-t-xl bg-gradient-to-b from-slate-200 to-slate-300" />
      </div>
      {/* 1st place */}
      <div className="flex flex-col items-center -mt-4">
        <Skeleton className="h-20 w-20 mb-2" rounded="full" />
        <Skeleton className="h-5 w-20 mb-1" />
        <Skeleton className="h-6 w-14" />
        <div className="mt-2 h-28 w-24 rounded-t-xl bg-gradient-to-b from-amber-200 to-amber-300" />
      </div>
      {/* 3rd place */}
      <div className="flex flex-col items-center">
        <Skeleton className="h-14 w-14 mb-2" rounded="full" />
        <Skeleton className="h-4 w-14 mb-1" />
        <Skeleton className="h-5 w-10" />
        <div className="mt-2 h-16 w-18 rounded-t-xl bg-gradient-to-b from-orange-200 to-orange-300" />
      </div>
    </div>
  );
}

/**
 * Full page loading skeleton for profile
 */
export function SkeletonProfilePage() {
  return (
    <div className="flex flex-col gap-5 pb-10 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between py-3">
        <Skeleton className="h-11 w-11" rounded="2xl" />
        <Skeleton className="h-8 w-24" rounded="full" />
        <div className="w-11" />
      </div>
      
      {/* Hero */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 p-6">
        <div className="flex flex-col items-center">
          <Skeleton className="h-24 w-24 mb-4" rounded="full" />
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-5 w-24 mb-4" />
          <Skeleton className="h-6 w-20" rounded="full" />
        </div>
        {/* Progress */}
        <div className="mt-6">
          <Skeleton className="h-3 w-full" rounded="full" />
          <div className="flex justify-between mt-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 rounded-2xl bg-white p-2 shadow-xl shadow-black/5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 flex-1" rounded="xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Full page loading skeleton for leaderboard
 */
export function SkeletonLeaderboardPage() {
  return (
    <div className="flex flex-col gap-5 pb-10 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between py-3">
        <Skeleton className="h-11 w-11" rounded="2xl" />
        <Skeleton className="h-8 w-28" rounded="full" />
        <div className="w-11" />
      </div>

      {/* Quiz selector */}
      <Skeleton className="h-20 w-full" rounded="2xl" />

      {/* Podium */}
      <SkeletonPodium />

      {/* List */}
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonLeaderboardEntry key={i} index={i} />
        ))}
      </div>
    </div>
  );
}

