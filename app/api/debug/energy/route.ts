/**
 * DEBUG: Energy diagnostics endpoint
 * Shows why energy may not be consumed for a specific user
 * 
 * GET /api/debug/energy
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;
const HOURS_PER_ATTEMPT = 4;
const ATTEMPT_COOLDOWN_MS = HOURS_PER_ATTEMPT * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  const userId = auth.user.id;
  const cooldownAgo = new Date(Date.now() - ATTEMPT_COOLDOWN_MS);
  
  // Get all data in parallel
  const [
    user,
    recentSessions,
    unfinishedSessions,
    activeTournaments,
    tournamentParticipation,
  ] = await Promise.all([
    // User info
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telegramId: true,
        username: true,
        bonusEnergy: true,
      },
    }),
    
    // Recent sessions (last 4 hours) - these consume energy slots
    prisma.quizSession.findMany({
      where: {
        userId,
        startedAt: { gte: cooldownAgo },
      },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        quizId: true,
        startedAt: true,
        finishedAt: true,
        totalScore: true,
      },
    }),
    
    // Unfinished sessions (potential "stuck" sessions)
    prisma.quizSession.findMany({
      where: {
        userId,
        finishedAt: null,
      },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        quizId: true,
        startedAt: true,
        currentQuestionIndex: true,
        quiz: { select: { title: true } },
      },
    }),
    
    // Active tournaments
    prisma.tournament.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        title: true,
        stages: {
          select: {
            id: true,
            quizId: true,
            order: true,
          },
        },
      },
    }),
    
    // User's tournament participation
    prisma.tournamentParticipant.findMany({
      where: {
        userId,
        tournament: { status: "ACTIVE" },
      },
      select: {
        tournamentId: true,
        status: true,
        currentStage: true,
        tournament: { select: { title: true } },
      },
    }),
  ]);
  
  // Calculate energy status
  const usedAttempts = recentSessions.length;
  const remainingEnergy = Math.max(0, MAX_ATTEMPTS - usedAttempts);
  const bonusEnergy = user?.bonusEnergy ?? 0;
  
  // Check if any quiz would be considered tournament quiz
  const tournamentQuizIds = new Set<number>();
  for (const t of activeTournaments) {
    for (const stage of t.stages) {
      if (stage.quizId) {
        tournamentQuizIds.add(stage.quizId);
      }
    }
  }
  
  // Find potential issues
  const issues: string[] = [];
  
  if (unfinishedSessions.length > 0) {
    issues.push(`⚠️ ${unfinishedSessions.length} unfinished session(s) - these are resumed instead of creating new`);
  }
  
  if (tournamentParticipation.length > 0) {
    issues.push(`🏆 Active in ${tournamentParticipation.length} tournament(s) - tournament quizzes don't consume energy`);
  }
  
  if (bonusEnergy > 0) {
    issues.push(`🎁 Has ${bonusEnergy} bonus energy - this is used instead of regular energy`);
  }
  
  // Next energy restoration time
  let nextEnergyAt: string | null = null;
  if (recentSessions.length > 0 && remainingEnergy < MAX_ATTEMPTS) {
    const oldestSession = recentSessions[recentSessions.length - 1];
    const nextSlot = new Date(oldestSession.startedAt.getTime() + ATTEMPT_COOLDOWN_MS);
    nextEnergyAt = nextSlot.toISOString();
  }
  
  return NextResponse.json({
    ok: true,
    user: {
      id: userId,
      telegramId: user?.telegramId,
      username: user?.username,
    },
    energy: {
      used: usedAttempts,
      remaining: remainingEnergy,
      max: MAX_ATTEMPTS,
      bonus: bonusEnergy,
      nextEnergyAt,
      hoursPerSlot: HOURS_PER_ATTEMPT,
    },
    recentSessions: recentSessions.map(s => ({
      id: s.id,
      quizId: s.quizId,
      startedAt: s.startedAt.toISOString(),
      finishedAt: s.finishedAt?.toISOString() ?? null,
      finished: !!s.finishedAt,
      score: s.totalScore,
      isTournamentQuiz: tournamentQuizIds.has(s.quizId),
    })),
    unfinishedSessions: unfinishedSessions.map(s => ({
      id: s.id,
      quizId: s.quizId,
      quizTitle: s.quiz.title,
      startedAt: s.startedAt.toISOString(),
      ageMinutes: Math.floor((Date.now() - s.startedAt.getTime()) / 60000),
      currentQuestion: s.currentQuestionIndex,
    })),
    tournaments: {
      active: activeTournaments.map(t => ({
        id: t.id,
        title: t.title,
        quizIds: t.stages.map(s => s.quizId).filter(Boolean),
      })),
      participating: tournamentParticipation.map(p => ({
        tournamentId: p.tournamentId,
        title: p.tournament.title,
        status: p.status,
        currentStage: p.currentStage,
      })),
    },
    issues,
    diagnosis: issues.length > 0 
      ? "⚠️ Found potential issues - see 'issues' array"
      : "✅ No obvious issues found",
  });
}

