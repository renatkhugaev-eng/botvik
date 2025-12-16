// Simple online count endpoint (polling-based)
// Returns approximate count based on recent activity

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Cache for 10 seconds
let cachedCount: number | null = null;
let cacheTime = 0;
const CACHE_TTL = 10000; // 10 seconds

export async function GET() {
  const now = Date.now();
  
  // Return cached value if fresh
  if (cachedCount !== null && now - cacheTime < CACHE_TTL) {
    return NextResponse.json({ count: cachedCount });
  }
  
  try {
    // Count users active in last 5 minutes
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
    
    const activeUsers = await prisma.quizSession.count({
      where: {
        OR: [
          { startedAt: { gte: fiveMinutesAgo } },
          { finishedAt: { gte: fiveMinutesAgo } },
        ],
      },
    });
    
    // Add some randomness to make it feel more "live"
    const baseCount = Math.max(activeUsers, 3);
    const variance = Math.floor(Math.random() * 5);
    const count = baseCount + variance;
    
    // Update cache
    cachedCount = count;
    cacheTime = now;
    
    return NextResponse.json(
      { count },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
        },
      }
    );
  } catch (error) {
    console.error("Online count error:", error);
    return NextResponse.json({ count: 5 }); // Fallback
  }
}
