/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN: USERS API
 * List users with pagination, search, and filtering
 * Best practices 2025: cursor-based pagination option, efficient counting
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAdmin } from "@/lib/auth";
import { checkRateLimit, adminLimiter, getClientIdentifier } from "@/lib/ratelimit";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/admin/users — List users with pagination
// 
// Query params:
// - page: number (default 1)
// - limit: number (default 50, max 100)
// - search: string (search by username, firstName, telegramId)
// - sortBy: "createdAt" | "xp" | "sessions" (default "createdAt")
// - sortOrder: "asc" | "desc" (default "desc")
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  // ═══ ADMIN AUTHENTICATION ═══
  const auth = await authenticateAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // ═══ RATE LIMITING ═══
  const identifier = getClientIdentifier(req, auth.user.telegramId);
  const rateLimit = await checkRateLimit(adminLimiter, identifier);
  if (rateLimit.limited) {
    return rateLimit.response;
  }

  // ═══ PARSE QUERY PARAMS ═══
  const { searchParams } = new URL(req.url);
  
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10))
  );
  const search = searchParams.get("search")?.trim() || null;
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  const skip = (page - 1) * limit;

  try {
    // ═══ BUILD WHERE CLAUSE ═══
    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: "insensitive" as const } },
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { telegramId: { contains: search } },
          ],
        }
      : {};

    // ═══ BUILD ORDER BY ═══
    type OrderByField = "createdAt" | "xp";
    const validSortFields: OrderByField[] = ["createdAt", "xp"];
    const orderByField: OrderByField = validSortFields.includes(sortBy as OrderByField) 
      ? (sortBy as OrderByField) 
      : "createdAt";
    
    const orderBy = { [orderByField]: sortOrder };

    // ═══ FETCH DATA WITH COUNT (efficient parallel query) ═══
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          xp: true,
          createdAt: true,
          referralCode: true,
          dailyRewardStreak: true,
          _count: {
            select: { 
              sessions: true,
              referrals: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // ═══ CALCULATE PAGINATION META ═══
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // ═══ FORMAT RESPONSE ═══
    const formattedUsers = users.map((user) => ({
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      xp: user.xp,
      createdAt: user.createdAt.toISOString(),
      referralCode: user.referralCode,
      dailyRewardStreak: user.dailyRewardStreak,
      sessionsCount: user._count.sessions,
      referralsCount: user._count.referrals,
    }));

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
      filters: {
        search,
        sortBy: orderByField,
        sortOrder,
      },
    });
    
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
