/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PANORAMA MISSION ADMIN API — Single Mission
 * 
 * GET    /api/admin/panorama/missions/[id] — Получить миссию
 * PATCH  /api/admin/panorama/missions/[id] — Обновить (публикация, featured)
 * DELETE /api/admin/panorama/missions/[id] — Удалить миссию
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// ═══════════════════════════════════════════════════════════════════════════
// GET — Получить миссию с полным JSON
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateAdmin(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const { id } = await params;
  
  try {
    const mission = await prisma.panoramaMission.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            username: true,
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
    });
    
    if (!mission) {
      return NextResponse.json(
        { ok: false, error: "Mission not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      ok: true,
      mission,
    });
  } catch (error) {
    console.error("[Admin Panorama Mission GET] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch mission" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PATCH — Обновить миссию (публикация, featured, метаданные)
// ═══════════════════════════════════════════════════════════════════════════

const UpdateMissionSchema = z.object({
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateAdmin(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const { id } = await params;
  
  try {
    const body = await req.json();
    const validation = UpdateMissionSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, error: "Ошибка валидации", details: validation.error.flatten() },
        { status: 400 }
      );
    }
    
    const updates = validation.data;
    
    // Проверяем существование
    const existing = await prisma.panoramaMission.findUnique({
      where: { id },
      select: { id: true, isPublished: true },
    });
    
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Mission not found" },
        { status: 404 }
      );
    }
    
    // Обновляем
    const updatedMission = await prisma.panoramaMission.update({
      where: { id },
      data: {
        ...updates,
        // Устанавливаем publishedAt при первой публикации
        ...(updates.isPublished === true && !existing.isPublished
          ? { publishedAt: new Date() }
          : {}),
      },
      select: {
        id: true,
        title: true,
        isPublished: true,
        isFeatured: true,
        publishedAt: true,
      },
    });
    
    console.log(`[Admin Panorama] Mission updated: ${id}, changes:`, updates);
    
    return NextResponse.json({
      ok: true,
      mission: updatedMission,
    });
  } catch (error) {
    console.error("[Admin Panorama Mission PATCH] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update mission" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE — Удалить миссию
// ═══════════════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateAdmin(req);
  
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const { id } = await params;
  
  try {
    // Проверяем существование и количество прохождений
    const mission = await prisma.panoramaMission.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        playCount: true,
        _count: { select: { attempts: true } },
      },
    });
    
    if (!mission) {
      return NextResponse.json(
        { ok: false, error: "Mission not found" },
        { status: 404 }
      );
    }
    
    // Предупреждение если есть прохождения
    if (mission._count.attempts > 0) {
      const { searchParams } = new URL(req.url);
      const force = searchParams.get("force") === "true";
      
      if (!force) {
        return NextResponse.json(
          { 
            ok: false, 
            error: "MISSION_HAS_ATTEMPTS",
            message: `У миссии есть ${mission._count.attempts} прохождений. Добавьте ?force=true для удаления.`,
            attemptsCount: mission._count.attempts,
          },
          { status: 409 }
        );
      }
    }
    
    // Удаляем (каскадно удалит attempts)
    await prisma.panoramaMission.delete({
      where: { id },
    });
    
    console.log(`[Admin Panorama] Mission deleted: ${id} (${mission.title})`);
    
    return NextResponse.json({
      ok: true,
      deleted: {
        id: mission.id,
        title: mission.title,
      },
    });
  } catch (error) {
    console.error("[Admin Panorama Mission DELETE] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete mission" },
      { status: 500 }
    );
  }
}

