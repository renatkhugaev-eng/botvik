import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type NotificationSettings = {
  notifyLevelUp: boolean;
  notifyEnergyFull: boolean;
  notifyDailyReminder: boolean;
  notifyLeaderboard: boolean;
  notifyFriends: boolean;
};

/**
 * GET /api/notifications/settings?userId=X
 * Get user's notification preferences
 */
export async function GET(req: NextRequest) {
  const userId = Number(req.nextUrl.searchParams.get("userId"));
  
  if (!userId || Number.isNaN(userId)) {
    return NextResponse.json({ error: "userId_required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      notifyLevelUp: true,
      notifyEnergyFull: true,
      notifyDailyReminder: true,
      notifyLeaderboard: true,
      notifyFriends: true,
    },
  });

  // Return default settings if user not found
  const defaultSettings = {
    notifyLevelUp: true,
    notifyEnergyFull: true,
    notifyDailyReminder: true,
    notifyLeaderboard: true,
    notifyFriends: true,
  };

  return NextResponse.json({
    settings: user ?? defaultSettings,
  });
}

/**
 * PUT /api/notifications/settings
 * Update user's notification preferences
 */
export async function PUT(req: NextRequest) {
  let body: { userId?: number; settings?: Partial<NotificationSettings> };
  
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const userId = body.userId;
  const settings = body.settings;

  if (!userId || !settings) {
    return NextResponse.json({ error: "userId_and_settings_required" }, { status: 400 });
  }

  // Validate that only allowed fields are being updated
  const allowedFields = [
    "notifyLevelUp",
    "notifyEnergyFull", 
    "notifyDailyReminder",
    "notifyLeaderboard",
    "notifyFriends",
  ];

  const updateData: Record<string, boolean> = {};
  
  for (const [key, value] of Object.entries(settings)) {
    if (allowedFields.includes(key) && typeof value === "boolean") {
      updateData[key] = value;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "no_valid_settings" }, { status: 400 });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        notifyLevelUp: true,
        notifyEnergyFull: true,
        notifyDailyReminder: true,
        notifyLeaderboard: true,
        notifyFriends: true,
      },
    });

    return NextResponse.json({
      success: true,
      settings: updatedUser,
    });
  } catch {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

