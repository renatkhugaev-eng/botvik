import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/friends?userId=X — Get user's friends and pending requests
export async function GET(req: NextRequest) {
  const userIdParam = req.nextUrl.searchParams.get("userId");
  const userId = userIdParam ? Number(userIdParam) : NaN;

  if (!userIdParam || Number.isNaN(userId)) {
    return NextResponse.json({ error: "userId_required" }, { status: 400 });
  }

  try {
    // Get accepted friendships (where user is either sender or receiver)
    const acceptedFriendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { userId: userId },
          { friendId: userId },
        ],
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, telegramId: true, photoUrl: true },
        },
        friend: {
          select: { id: true, username: true, firstName: true, telegramId: true, photoUrl: true },
        },
      },
    });

    // Get pending requests sent TO this user (incoming)
    const incomingRequests = await prisma.friendship.findMany({
      where: {
        friendId: userId,
        status: "PENDING",
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, telegramId: true, photoUrl: true },
        },
      },
    });

    // Get pending requests sent BY this user (outgoing)
    const outgoingRequests = await prisma.friendship.findMany({
      where: {
        userId: userId,
        status: "PENDING",
      },
      include: {
        friend: {
          select: { id: true, username: true, firstName: true, telegramId: true, photoUrl: true },
        },
      },
    });

    // Process accepted friends with stats
    // OPTIMIZED: Batch queries instead of N+1
    
    // Extract all friend IDs
    const friendIds = acceptedFriendships.map(f => 
      f.userId === userId ? f.friend.id : f.user.id
    );
    
    // Batch query: Get all leaderboard entries for all friends at once
    const allLeaderboardEntries = friendIds.length > 0 
      ? await prisma.leaderboardEntry.findMany({
          where: { userId: { in: friendIds } },
          select: { userId: true, bestScore: true, attempts: true },
        })
      : [];
    
    // Batch query: Get games played count for all friends at once
    const allGamesCounts = friendIds.length > 0
      ? await prisma.quizSession.groupBy({
          by: ["userId", "quizId"],
          where: { 
            userId: { in: friendIds }, 
            finishedAt: { not: null } 
          },
        })
      : [];
    
    // Create lookup maps for O(1) access
    const leaderboardByUser = new Map<number, typeof allLeaderboardEntries>();
    for (const entry of allLeaderboardEntries) {
      const existing = leaderboardByUser.get(entry.userId) || [];
      existing.push(entry);
      leaderboardByUser.set(entry.userId, existing);
    }
    
    const gamesCountByUser = new Map<number, number>();
    for (const game of allGamesCounts) {
      const current = gamesCountByUser.get(game.userId) || 0;
      gamesCountByUser.set(game.userId, current + 1);
    }
    
    // Process friends using pre-fetched data (no additional queries)
    const friendsWithStats = acceptedFriendships.map((f) => {
      const friendData = f.userId === userId ? f.friend : f.user;
      const entries = leaderboardByUser.get(friendData.id) || [];
      const gamesPlayed = gamesCountByUser.get(friendData.id) || 0;
      
      // Calculate scores from cached data
      const totalBestScore = entries.reduce((sum, e) => sum + e.bestScore, 0);
      const totalAttempts = entries.reduce((sum, e) => sum + e.attempts, 0);
      const activityBonus = Math.min(totalAttempts * 50, 500);
      const totalScore = totalBestScore + activityBonus;
      const bestScore = entries.length > 0 
        ? Math.max(...entries.map(e => e.bestScore))
        : 0;

      return {
        friendshipId: f.id,
        id: friendData.id,
        username: friendData.username,
        firstName: friendData.firstName,
        telegramId: friendData.telegramId,
        photoUrl: friendData.photoUrl,
        stats: {
          totalScore,
          gamesPlayed,
          bestScore,
        },
        addedAt: f.createdAt,
      };
    });

    // Process incoming requests
    const incoming = incomingRequests.map((r) => ({
      requestId: r.id,
      id: r.user.id,
      username: r.user.username,
      firstName: r.user.firstName,
      photoUrl: r.user.photoUrl,
      sentAt: r.createdAt,
    }));

    // Process outgoing requests
    const outgoing = outgoingRequests.map((r) => ({
      requestId: r.id,
      id: r.friend.id,
      username: r.friend.username,
      firstName: r.friend.firstName,
      photoUrl: r.friend.photoUrl,
      sentAt: r.createdAt,
    }));

    return NextResponse.json({
      friends: friendsWithStats,
      incomingRequests: incoming,
      outgoingRequests: outgoing,
    });
  } catch (error) {
    console.error("[friends] Error fetching friends:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// POST /api/friends — Send a friend request
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

    // Check if any friendship/request already exists
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: userId, friendId: friend.id },
          { userId: friend.id, friendId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === "ACCEPTED") {
        return NextResponse.json({ error: "already_friends" }, { status: 400 });
      }
      if (existing.status === "PENDING") {
        // If they sent us a request, auto-accept it
        if (existing.userId === friend.id) {
          await prisma.friendship.update({
            where: { id: existing.id },
            data: { status: "ACCEPTED" },
          });
          return NextResponse.json({ ok: true, status: "accepted" });
        }
        return NextResponse.json({ error: "request_pending" }, { status: 400 });
      }
      if (existing.status === "DECLINED") {
        // Update declined to pending (they can try again)
        await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: "PENDING", userId: userId, friendId: friend.id },
        });
        return NextResponse.json({ ok: true, status: "request_sent" });
      }
    }

    // Create new friend request
    await prisma.friendship.create({
      data: {
        userId: userId,
        friendId: friend.id,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      ok: true,
      status: "request_sent",
      friend: {
        id: friend.id,
        username: friend.username,
        firstName: friend.firstName,
      },
    });
  } catch (error) {
    console.error("[friends] Error sending request:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// PUT /api/friends — Accept or decline a friend request
export async function PUT(req: NextRequest) {
  try {
    const { requestId, action } = await req.json();

    if (!requestId || !action) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }

    if (action !== "accept" && action !== "decline") {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }

    const friendship = await prisma.friendship.findUnique({
      where: { id: requestId },
    });

    if (!friendship || friendship.status !== "PENDING") {
      return NextResponse.json({ error: "request_not_found" }, { status: 404 });
    }

    await prisma.friendship.update({
      where: { id: requestId },
      data: { status: action === "accept" ? "ACCEPTED" : "DECLINED" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[friends] Error updating request:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// DELETE /api/friends — Remove a friend or cancel request
export async function DELETE(req: NextRequest) {
  try {
    const { friendshipId } = await req.json();

    if (!friendshipId) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }

    await prisma.friendship.delete({
      where: { id: friendshipId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[friends] Error removing friend:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
