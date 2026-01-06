import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { getRedisClient, isRateLimitConfigured } from "@/lib/ratelimit";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// CACHE CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const SHOP_ITEMS_CACHE_KEY = "shop:items";
const SHOP_ITEMS_TTL = 300; // 5 minutes - items don't change often

type CachedShopItem = {
  id: number;
  slug: string;
  type: string;
  title: string;
  description: string | null;
  imageUrl: string;
  previewUrl: string | null;
  priceStars: number;
  rarity: string;
};

type CachedShopData = {
  items: CachedShopItem[];
  cachedAt: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/shop — Список товаров магазина (Redis-cached)
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  // Попытка аутентификации (необязательно)
  const auth = await authenticateRequest(req);
  const userId = auth.ok ? auth.user.id : null;

  // ═══ Get items (from cache or DB) ═══
  let items: CachedShopItem[];
  let fromCache = false;
  
  try {
    // Try Redis cache first
    if (isRateLimitConfigured()) {
      const redis = getRedisClient();
      const cached = await redis.get<CachedShopData>(SHOP_ITEMS_CACHE_KEY);
      
      if (cached && cached.items) {
        items = cached.items;
        fromCache = true;
      } else {
        // Cache miss - fetch from DB
        const dbItems = await prisma.cosmeticItem.findMany({
          where: { isActive: true },
          orderBy: [
            { priceStars: "desc" },
            { createdAt: "desc" },
          ],
          select: {
            id: true,
            slug: true,
            type: true,
            title: true,
            description: true,
            imageUrl: true,
            previewUrl: true,
            priceStars: true,
            rarity: true,
          },
        });
        
        items = dbItems;
        
        // Store in cache
        await redis.set(SHOP_ITEMS_CACHE_KEY, {
          items: dbItems,
          cachedAt: Date.now(),
        }, { ex: SHOP_ITEMS_TTL });
      }
    } else {
      // No Redis - fetch from DB
      const dbItems = await prisma.cosmeticItem.findMany({
        where: { isActive: true },
        orderBy: [
          { priceStars: "desc" },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          slug: true,
          type: true,
          title: true,
          description: true,
          imageUrl: true,
          previewUrl: true,
          priceStars: true,
          rarity: true,
        },
      });
      items = dbItems;
    }
  } catch (error) {
    console.error("[shop] Failed to fetch items:", error);
    return NextResponse.json({ ok: false, error: "db_error", items: [], equippedFrameId: null }, { status: 500 });
  }

  // ═══ Add ownership info for authenticated users ═══
  if (userId) {
    const [inventory, user] = await Promise.all([
      prisma.userInventory.findMany({
        where: { userId },
        select: { itemId: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { equippedFrameId: true },
      }),
    ]);

    const ownedItemIds = new Set(inventory.map((i) => i.itemId));
    const equippedFrameId = user?.equippedFrameId;

    const itemsWithOwnership = items.map((item) => ({
      ...item,
      owned: ownedItemIds.has(item.id),
      equipped: item.id === equippedFrameId,
    }));

    return NextResponse.json({
      ok: true,
      items: itemsWithOwnership,
      equippedFrameId,
    }, {
      headers: {
        "X-Cache": fromCache ? "HIT" : "MISS",
      },
    });
  }

  // Без авторизации — просто список товаров
  return NextResponse.json({
    ok: true,
    items: items.map((item) => ({
      ...item,
      owned: false,
      equipped: false,
    })),
    equippedFrameId: null,
  }, {
    headers: {
      "X-Cache": fromCache ? "HIT" : "MISS",
    },
  });
}
