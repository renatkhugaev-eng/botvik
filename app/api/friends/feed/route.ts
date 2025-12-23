import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/friends/feed?userId=X — Get activity feed from friends
export async function GET(req: NextRequest) {
  const userIdParam = req.nextUrl.searchParams.get("userId");
  const limitParam = req.nextUrl.searchParams.get("limit");
  const cursorParam = req.nextUrl.searchParams.get("cursor");
  
  const userId = userIdParam ? Number(userIdParam) : NaN;
  const limit = limitParam ? Math.min(Number(limitParam), 50) : 20;
  const cursor = cursorParam ? Number(cursorParam) : undefined;

  if (!userIdParam || Number.isNaN(userId)) {
    return NextResponse.json({ error: "userId_required" }, { status: 400 });
  }

  try {
    // 1. Get user's friend IDs (accepted friendships)
    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { userId: userId },
          { friendId: userId },
        ],
      },
      select: {
        userId: true,
        friendId: true,
      },
    });

    // Extract friend IDs
    const friendIds = friendships.map(f => 
      f.userId === userId ? f.friendId : f.userId
    );

    if (friendIds.length === 0) {
      return NextResponse.json({
        activities: [],
        nextCursor: null,
        hasMore: false,
      });
    }

    // 2. Get activities from friends
    const activities = await prisma.userActivity.findMany({
      where: {
        userId: { in: friendIds },
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1, // +1 to check if there are more
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            username: true,
            photoUrl: true,
            xp: true,
          },
        },
      },
    });

    // Check if there are more items
    const hasMore = activities.length > limit;
    const items = hasMore ? activities.slice(0, limit) : activities;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    // Format response
    const formattedActivities = items.map(activity => ({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      icon: activity.icon,
      data: activity.data,
      createdAt: activity.createdAt,
      user: {
        id: activity.user.id,
        firstName: activity.user.firstName,
        username: activity.user.username,
        photoUrl: activity.user.photoUrl,
        xp: activity.user.xp,
      },
    }));

    return NextResponse.json({
      activities: formattedActivities,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("[friends/feed] Error fetching feed:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
