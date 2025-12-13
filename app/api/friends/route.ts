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
    // Используем leaderboard score для согласованности с лидербордом
    const friendsWithStats = await Promise.all(
      acceptedFriendships.map(async (f) => {
        const friendData = f.userId === userId ? f.friend : f.user;
        
        // Считаем количество уникальных квизов (игр)
        const gamesPlayed = await prisma.quizSession.groupBy({
          by: ["quizId"],
          where: { userId: friendData.id, finishedAt: { not: null } },
        });
        
        // Получаем все leaderboard entries для суммарного score
        const leaderboardEntries = await prisma.leaderboardEntry.findMany({
          where: { userId: friendData.id },
          select: { score: true },
        });
        
        // Сумма weighted scores (согласовано с лидербордом)
        const totalScore = leaderboardEntries.reduce((sum, e) => sum + e.score, 0);
        
        // Лучший weighted score
        const bestScore = leaderboardEntries.length > 0 
          ? Math.max(...leaderboardEntries.map(e => e.score))
          : 0;

        return {
          friendshipId: f.id,
          id: friendData.id,
          username: friendData.username,
          firstName: friendData.firstName,
          telegramId: friendData.telegramId,
          photoUrl: friendData.photoUrl,
          stats: {
            totalScore,                          // Сумма weighted scores
            gamesPlayed: gamesPlayed.length,     // Количество уникальных квизов
            bestScore,                           // Лучший weighted score
          },
          addedAt: f.createdAt,
        };
      })
    );

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
