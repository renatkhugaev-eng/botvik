/**
 * Profile 2.0 API - Управление расширенным профилем пользователя
 * 
 * GET  - Получить профиль
 * PUT  - Обновить профиль (bio, status, showcase achievements, privacy)
 * POST - Обновить "сейчас играет" статус
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { errors, success } from "@/lib/api-response";
import { UserStatus } from "@prisma/client";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// Константы
// ═══════════════════════════════════════════════════════════════════════════

const MAX_BIO_LENGTH = 100;
const MAX_STATUS_TEXT_LENGTH = 50;
const MAX_STATUS_EMOJI_LENGTH = 10;

// Предустановленные статусы
const PRESET_STATUSES = [
  { id: "online", emoji: "🟢", text: "В сети", status: "ONLINE" as UserStatus },
  { id: "looking_duel", emoji: "⚔️", text: "Ищу дуэль", status: "LOOKING_DUEL" as UserStatus },
  { id: "busy", emoji: "🔴", text: "Занят", status: "BUSY" as UserStatus },
  { id: "detective", emoji: "🕵️", text: "Расследую дело", status: "ONLINE" as UserStatus },
  { id: "champion", emoji: "🏆", text: "На турнире", status: "PLAYING" as UserStatus },
  { id: "coffee", emoji: "☕", text: "Перерыв", status: "BUSY" as UserStatus },
  { id: "thinking", emoji: "🤔", text: "Думаю...", status: "ONLINE" as UserStatus },
  { id: "fire", emoji: "🔥", text: "В ударе!", status: "ONLINE" as UserStatus },
  { id: "sleepy", emoji: "😴", text: "Засыпаю", status: "BUSY" as UserStatus },
  { id: "night", emoji: "🌙", text: "Ночной режим", status: "BUSY" as UserStatus },
];

// ═══════════════════════════════════════════════════════════════════════════
// GET - Получить профиль
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return errors.unauthorized();
  }
  
  const userId = auth.user.id;
  
  // Опционально - просмотр чужого профиля
  const targetUserIdParam = req.nextUrl.searchParams.get("userId");
  const targetUserId = targetUserIdParam ? parseInt(targetUserIdParam, 10) : userId;
  const isOwnProfile = targetUserId === userId;
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        createdAt: true,
        xp: true,
        
        // Profile 2.0 fields
        bio: true,
        status: true,
        statusEmoji: true,
        statusText: true,
        lastSeenAt: true,
        showcaseAchievement1: true,
        showcaseAchievement2: true,
        showcaseAchievement3: true,
        profilePublic: true,
        showActivity: true,
        showOnlineStatus: true,
        currentQuizId: true,
        currentQuiz: {
          select: {
            id: true,
            title: true,
          },
        },
        currentSessionStart: true,
        
        // Equipped cosmetics
        equippedFrame: {
          select: {
            id: true,
            slug: true,
            title: true,
            imageUrl: true,
          },
        },
        
        // For showcase achievements - get unlocked achievements
        achievements: {
          select: {
            achievementId: true,
            unlockedAt: true,
          },
        },
      },
    });
    
    if (!user) {
      return errors.notFound("User");
    }
    
    // Проверка приватности
    if (!isOwnProfile && !user.profilePublic) {
      return NextResponse.json({
        ok: true,
        data: {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          photoUrl: user.photoUrl,
          isPrivate: true,
        },
      });
    }
    
    // Формируем showcase achievements с деталями
    const showcaseIds = [
      user.showcaseAchievement1,
      user.showcaseAchievement2,
      user.showcaseAchievement3,
    ].filter(Boolean) as string[];
    
    // Убираем "сейчас играет" если не показываем активность
    const currentlyPlaying = isOwnProfile || user.showActivity
      ? user.currentQuiz
        ? { quizId: user.currentQuiz.id, title: user.currentQuiz.title, since: user.currentSessionStart }
        : null
      : null;
    
    // Скрываем онлайн статус если настройка отключена
    const displayStatus = isOwnProfile || user.showOnlineStatus
      ? user.status
      : null;
    
    const displayLastSeen = isOwnProfile || user.showOnlineStatus
      ? user.lastSeenAt
      : null;
    
    return success({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      createdAt: user.createdAt,
      xp: user.xp,
      
      // Profile 2.0
      bio: user.bio,
      status: displayStatus,
      statusEmoji: user.statusEmoji,
      statusText: user.statusText,
      lastSeenAt: displayLastSeen,
      currentlyPlaying,
      
      // Showcase
      showcaseAchievements: showcaseIds,
      unlockedAchievements: user.achievements.map((a) => a.achievementId),
      
      // Privacy (только для своего профиля)
      ...(isOwnProfile && {
        privacy: {
          profilePublic: user.profilePublic,
          showActivity: user.showActivity,
          showOnlineStatus: user.showOnlineStatus,
        },
      }),
      
      // Cosmetics
      equippedFrame: user.equippedFrame,
      
      // Presets for UI
      presetStatuses: PRESET_STATUSES,
    });
  } catch (error) {
    logger.error("[Profile] Failed to get profile:", error);
    return errors.internalServerError();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT - Обновить профиль
// ═══════════════════════════════════════════════════════════════════════════

type UpdateProfileBody = {
  bio?: string | null;
  status?: UserStatus;
  statusEmoji?: string | null;
  statusText?: string | null;
  showcaseAchievements?: (string | null)[];
  privacy?: {
    profilePublic?: boolean;
    showActivity?: boolean;
    showOnlineStatus?: boolean;
  };
};

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return errors.unauthorized();
  }
  
  const userId = auth.user.id;
  
  try {
    const body = (await req.json()) as UpdateProfileBody;
    
    // Валидация
    const updateData: Record<string, unknown> = {
      lastSeenAt: new Date(), // Обновляем lastSeenAt при любом действии
    };
    
    // Bio
    if (body.bio !== undefined) {
      if (body.bio && body.bio.length > MAX_BIO_LENGTH) {
        return errors.badRequest(`Bio must be ${MAX_BIO_LENGTH} characters or less`);
      }
      updateData.bio = body.bio?.trim() || null;
    }
    
    // Status
    if (body.status !== undefined) {
      if (!Object.values(UserStatus).includes(body.status)) {
        return errors.badRequest("Invalid status");
      }
      updateData.status = body.status;
    }
    
    // Status Emoji
    if (body.statusEmoji !== undefined) {
      if (body.statusEmoji && body.statusEmoji.length > MAX_STATUS_EMOJI_LENGTH) {
        return errors.badRequest(`Status emoji too long`);
      }
      updateData.statusEmoji = body.statusEmoji?.trim() || null;
    }
    
    // Status Text
    if (body.statusText !== undefined) {
      if (body.statusText && body.statusText.length > MAX_STATUS_TEXT_LENGTH) {
        return errors.badRequest(`Status text must be ${MAX_STATUS_TEXT_LENGTH} characters or less`);
      }
      updateData.statusText = body.statusText?.trim() || null;
    }
    
    // Showcase Achievements
    if (body.showcaseAchievements !== undefined) {
      const achievements = body.showcaseAchievements.slice(0, 3);
      
      // Проверяем что пользователь разблокировал эти достижения
      if (achievements.filter(Boolean).length > 0) {
        const unlockedAchievements = await prisma.userAchievement.findMany({
          where: {
            userId,
            achievementId: { in: achievements.filter(Boolean) as string[] },
          },
          select: { achievementId: true },
        });
        
        const unlockedIds = new Set(unlockedAchievements.map((a) => a.achievementId));
        
        for (let i = 0; i < 3; i++) {
          const achievementId = achievements[i] || null;
          if (achievementId && !unlockedIds.has(achievementId)) {
            return errors.badRequest(`Achievement ${achievementId} is not unlocked`);
          }
          updateData[`showcaseAchievement${i + 1}`] = achievementId;
        }
      } else {
        updateData.showcaseAchievement1 = null;
        updateData.showcaseAchievement2 = null;
        updateData.showcaseAchievement3 = null;
      }
    }
    
    // Privacy Settings
    if (body.privacy) {
      if (body.privacy.profilePublic !== undefined) {
        updateData.profilePublic = body.privacy.profilePublic;
      }
      if (body.privacy.showActivity !== undefined) {
        updateData.showActivity = body.privacy.showActivity;
      }
      if (body.privacy.showOnlineStatus !== undefined) {
        updateData.showOnlineStatus = body.privacy.showOnlineStatus;
      }
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        bio: true,
        status: true,
        statusEmoji: true,
        statusText: true,
        showcaseAchievement1: true,
        showcaseAchievement2: true,
        showcaseAchievement3: true,
        profilePublic: true,
        showActivity: true,
        showOnlineStatus: true,
      },
    });
    
    logger.info(`[Profile] User ${userId} updated profile`, { fields: Object.keys(updateData) });
    
    return success({
      bio: updatedUser.bio,
      status: updatedUser.status,
      statusEmoji: updatedUser.statusEmoji,
      statusText: updatedUser.statusText,
      showcaseAchievements: [
        updatedUser.showcaseAchievement1,
        updatedUser.showcaseAchievement2,
        updatedUser.showcaseAchievement3,
      ].filter(Boolean),
      privacy: {
        profilePublic: updatedUser.profilePublic,
        showActivity: updatedUser.showActivity,
        showOnlineStatus: updatedUser.showOnlineStatus,
      },
    });
  } catch (error) {
    logger.error("[Profile] Failed to update profile:", error);
    return errors.internalServerError();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST - Обновить "сейчас играет" (вызывается из quiz start/finish)
// ═══════════════════════════════════════════════════════════════════════════

type UpdatePlayingBody = {
  quizId?: number | null;
  action: "start" | "stop";
};

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return errors.unauthorized();
  }
  
  const userId = auth.user.id;
  
  try {
    const body = (await req.json()) as UpdatePlayingBody;
    
    if (body.action === "start" && body.quizId) {
      // Начал играть
      await prisma.user.update({
        where: { id: userId },
        data: {
          currentQuizId: body.quizId,
          currentSessionStart: new Date(),
          status: "PLAYING",
          lastSeenAt: new Date(),
        },
      });
      
      return success({ playing: true, quizId: body.quizId });
    } else if (body.action === "stop") {
      // Закончил играть
      await prisma.user.update({
        where: { id: userId },
        data: {
          currentQuizId: null,
          currentSessionStart: null,
          status: "ONLINE",
          lastSeenAt: new Date(),
        },
      });
      
      return success({ playing: false });
    }
    
    return errors.badRequest("Invalid action");
  } catch (error) {
    logger.error("[Profile] Failed to update playing status:", error);
    return errors.internalServerError();
  }
}

