import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/cache/clear
 * Очищает Redis кэш квизов
 */
export async function POST(req: NextRequest) {
  try {
    const redis = getRedisClient();
    
    if (!redis) {
      return NextResponse.json({ 
        ok: false, 
        error: "Redis not configured" 
      }, { status: 500 });
    }

    // Удаляем все ключи кэша квизов
    const keysToDelete = [
      "quiz:list:*",
      "quiz:details:*", 
      "quiz:questions:*",
      "tournament:quiz_ids",
    ];

    let deleted = 0;

    for (const pattern of keysToDelete) {
      try {
        // Получаем ключи по паттерну
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          deleted += keys.length;
        }
      } catch (e) {
        console.error(`Failed to delete keys for pattern ${pattern}:`, e);
      }
    }

    console.log(`[Cache Clear] Deleted ${deleted} keys`);

    return NextResponse.json({ 
      ok: true, 
      deleted,
      message: `Кэш очищен (${deleted} ключей)` 
    });

  } catch (error) {
    console.error("[Cache Clear] Error:", error);
    return NextResponse.json({ 
      ok: false, 
      error: "Failed to clear cache" 
    }, { status: 500 });
  }
}

