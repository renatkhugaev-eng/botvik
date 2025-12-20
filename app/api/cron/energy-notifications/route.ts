import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyEnergyFull } from "@/lib/notifications";
import { getRedisClient } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const MAX_ENERGY = 5;
const HOURS_PER_ENERGY = 4;
const ENERGY_COOLDOWN_MS = HOURS_PER_ENERGY * 60 * 60 * 1000; // 4 hours

// Redis key prefix for tracking energy notifications
const ENERGY_NOTIFIED_PREFIX = "energy:notified:";
// TTL: slightly longer than one energy slot (5 hours)
const ENERGY_NOTIFIED_TTL_MS = 5 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════
// REDIS HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if user was already notified about full energy recently
 */
async function wasEnergyNotifiedRecently(userId: number): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key = `${ENERGY_NOTIFIED_PREFIX}${userId}`;
    const value = await redis.get(key);
    return value !== null;
  } catch {
    return false; // If Redis fails, allow notification
  }
}

/**
 * Mark user as notified about full energy
 */
async function markEnergyNotified(userId: number): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = `${ENERGY_NOTIFIED_PREFIX}${userId}`;
    await redis.set(key, "1", { px: ENERGY_NOTIFIED_TTL_MS });
  } catch (error) {
    console.error("[energy-notifications] Redis error:", error);
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN LOGIC
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate current energy for a user based on their recent sessions
 */
async function calculateUserEnergy(userId: number): Promise<{
  currentEnergy: number;
  wasAtZero: boolean;
}> {
  const cooldownAgo = new Date(Date.now() - ENERGY_COOLDOWN_MS * MAX_ENERGY);
  
  // Get all sessions within the energy window (20 hours)
  const sessions = await prisma.quizSession.findMany({
    where: {
      userId,
      startedAt: { gte: cooldownAgo },
    },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });
  
  // Filter sessions that still count (within their 4-hour window)
  const now = Date.now();
  const activeSessions = sessions.filter(s => {
    const expiresAt = s.startedAt.getTime() + ENERGY_COOLDOWN_MS;
    return expiresAt > now;
  });
  
  const usedEnergy = activeSessions.length;
  const currentEnergy = Math.max(0, MAX_ENERGY - usedEnergy);
  
  // Check if user was at zero energy before (all 5 sessions were active)
  // by looking at the oldest session that just expired
  const recentlyExpiredSession = sessions.find(s => {
    const expiresAt = s.startedAt.getTime() + ENERGY_COOLDOWN_MS;
    const expiredWithinLastHour = expiresAt <= now && expiresAt > now - 60 * 60 * 1000;
    return expiredWithinLastHour;
  });
  
  // User was at zero if they had 5 sessions and one just expired
  const wasAtZero = sessions.length >= MAX_ENERGY && !!recentlyExpiredSession;
  
  return { currentEnergy, wasAtZero };
}

/**
 * POST /api/cron/energy-notifications
 * 
 * Check for users whose energy just restored and notify them.
 * Should run every 30 minutes via Vercel Cron.
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  
  const results = {
    checked: 0,
    notified: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };
  
  try {
    // Find users who:
    // 1. Have energy notifications enabled
    // 2. Had a session that ended ~4 hours ago (energy slot restored)
    const fourHoursAgo = new Date(Date.now() - ENERGY_COOLDOWN_MS);
    const fiveHoursAgo = new Date(Date.now() - ENERGY_COOLDOWN_MS - 60 * 60 * 1000);
    
    // Get users who had sessions start 4-5 hours ago (energy just restored)
    const usersWithRestoredEnergy = await prisma.quizSession.findMany({
      where: {
        startedAt: {
          gte: fiveHoursAgo,
          lte: fourHoursAgo,
        },
      },
      distinct: ['userId'],
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            notifyEnergyFull: true,
          },
        },
      },
    });
    
    results.checked = usersWithRestoredEnergy.length;
    
    for (const session of usersWithRestoredEnergy) {
      const user = session.user;
      
      // Skip if notifications disabled
      if (!user.notifyEnergyFull) {
        results.skipped++;
        continue;
      }
      
      try {
        // Check if already notified recently
        const alreadyNotified = await wasEnergyNotifiedRecently(user.id);
        if (alreadyNotified) {
          results.skipped++;
          continue;
        }
        
        // Calculate current energy
        const { currentEnergy } = await calculateUserEnergy(user.id);
        
        // Only notify if energy is at max or restored at least 1
        if (currentEnergy >= 1) {
          const success = await notifyEnergyFull(user.id, currentEnergy, MAX_ENERGY);
          
          if (success) {
            await markEnergyNotified(user.id);
            results.notified++;
          } else {
            results.failed++;
          }
        } else {
          results.skipped++;
        }
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.error(`[energy-notifications] Error for user ${user.id}:`, error);
        results.failed++;
        results.errors.push(`User ${user.id}: ${String(error)}`);
      }
    }
    
    if (results.notified > 0) {
      console.log(
        `[energy-notifications] Complete: ${results.checked} checked, ` +
        `${results.notified} notified, ${results.skipped} skipped, ${results.failed} failed`
      );
    }
    
    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error("[energy-notifications] Fatal error:", error);
    return NextResponse.json(
      { error: "internal_error", message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET for health check
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/energy-notifications",
    description: "Notify users when energy is restored",
    method: "POST",
    auth: "Bearer CRON_SECRET",
    schedule: "Every 30 minutes",
  });
}
