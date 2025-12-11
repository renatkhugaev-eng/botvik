import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/friends?userId=X — Get user's friends with their stats
export async function GET(req: NextRequest) {
  const userIdParam = req.nextUrl.searchParams.get("userId");
  const userId = userIdParam ? Number(userIdParam) : NaN;

  if (!userIdParam || Number.isNaN(userId)) {
    return NextResponse.json({ error: "userId_required" }, { status: 400 });
  }

  try {
    // Get all friendships where user is either the adder or receiver
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: userId },
          { friendId: userId },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            telegramId: true,
          },
        },
        friend: {
          select: {
            id: true,
            username: true,
            firstName: true,
            telegramId: true,
          },
        },
      },
    });

    // Extract friend data (the other person in each friendship)
    const friendIds = friendships.map((f) => 
      f.userId === userId ? f.friendId : f.userId
    );

    // Get stats for all friends
    const friendsWithStats = await Promise.all(
      friendships.map(async (f) => {
        const friendData = f.userId === userId ? f.friend : f.user;
        
        // Get friend's stats
        const sessions = await prisma.quizSession.findMany({
          where: { userId: friendData.id, finishedAt: { not: null } },
          select: { totalScore: true },
        });
        
        const totalScore = sessions.reduce((sum, s) => sum + s.totalScore, 0);
        const gamesPlayed = sessions.length;
        
        // Get best leaderboard position
        const bestEntry = await prisma.leaderboardEntry.findFirst({
          where: { userId: friendData.id },
          orderBy: { score: "desc" },
        });

        return {
          friendshipId: f.id,
          id: friendData.id,
          username: friendData.username,
          firstName: friendData.firstName,
          telegramId: friendData.telegramId,
          stats: {
            totalScore,
            gamesPlayed,
            bestScore: bestEntry?.score ?? 0,
          },
          addedAt: f.createdAt,
        };
      })
    );

    return NextResponse.json(friendsWithStats);
  } catch (error) {
    console.error("[friends] Error fetching friends:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// POST /api/friends — Add a friend by username
export async function POST(req: NextRequest) {
  try {
    const { userId, friendUsername } = await req.json();

    if (!userId || !friendUsername) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }

    // Find friend by username
    const friend = await prisma.user.findFirst({
      where: {
        username: {
          equals: friendUsername.replace("@", ""),
          mode: "insensitive",
        },
      },
    });

    if (!friend) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    if (friend.id === userId) {
      return NextResponse.json({ error: "cannot_add_self" }, { status: 400 });
    }

    // Check if already friends
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: userId, friendId: friend.id },
          { userId: friend.id, friendId: userId },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ error: "already_friends" }, { status: 400 });
    }

    // Create friendship
    const friendship = await prisma.friendship.create({
      data: {
        userId: userId,
        friendId: friend.id,
      },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            firstName: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      friend: {
        id: friendship.friend.id,
        username: friendship.friend.username,
        firstName: friendship.friend.firstName,
      },
    });
  } catch (error) {
    console.error("[friends] Error adding friend:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// DELETE /api/friends — Remove a friend
export async function DELETE(req: NextRequest) {
  try {
    const { userId, friendId } = await req.json();

    if (!userId || !friendId) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }

    // Delete friendship in either direction
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: userId, friendId: friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[friends] Error removing friend:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

