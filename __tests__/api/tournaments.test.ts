/**
 * Tournament System Tests
 * Тесты турнирной системы
 */

import { prisma } from "@/lib/prisma";

// Mock authenticateRequest
jest.mock("@/lib/auth", () => ({
  authenticateRequest: jest.fn(),
}));

import { authenticateRequest } from "@/lib/auth";

const mockAuth = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;

describe("Tournament System", () => {
  // Тестовые данные
  let testUser: { id: number; telegramId: string };
  let testTournament: { id: number; slug: string };
  let testQuiz: { id: number };

  beforeAll(async () => {
    // Создаём тестового пользователя
    testUser = await prisma.user.create({
      data: {
        telegramId: `test_tournament_${Date.now()}`,
        username: "tournament_tester",
        xp: 1000,
      },
    });

    // Создаём тестовый квиз
    testQuiz = await prisma.quiz.create({
      data: {
        title: "Test Tournament Quiz",
        description: "Quiz for tournament testing",
        prizeTitle: "Test Prize",
        isActive: true,
      },
    });

    // Создаём тестовый турнир
    testTournament = await prisma.tournament.create({
      data: {
        slug: `test-tournament-${Date.now()}`,
        title: "Test Tournament",
        description: "Tournament for testing",
        status: "ACTIVE",
        type: "QUIZ",
        startsAt: new Date(Date.now() - 1000 * 60 * 60), // Начался час назад
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // Заканчивается через день
        entryFee: 50,
        maxPlayers: 100,
        stages: {
          create: [
            {
              order: 1,
              title: "Первый этап",
              type: "QUIZ",
              quizId: testQuiz.id,
              scoreMultiplier: 1.0,
              minScore: 100,
            },
            {
              order: 2,
              title: "Второй этап",
              type: "QUIZ",
              quizId: testQuiz.id,
              scoreMultiplier: 1.5,
              minScore: 150,
            },
          ],
        },
        prizes: {
          create: [
            { place: 1, type: "XP", value: 1000, title: "Первое место" },
            { place: 2, type: "XP", value: 500, title: "Второе место" },
            { place: 3, type: "XP", value: 250, title: "Третье место" },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    // Очищаем тестовые данные (если они были созданы)
    try {
      if (testTournament?.id) {
        await prisma.tournamentStageResult.deleteMany({
          where: { stage: { tournamentId: testTournament.id } },
        });
        await prisma.tournamentParticipant.deleteMany({
          where: { tournamentId: testTournament.id },
        });
        await prisma.tournamentPrize.deleteMany({
          where: { tournamentId: testTournament.id },
        });
        await prisma.tournamentStage.deleteMany({
          where: { tournamentId: testTournament.id },
        });
        await prisma.tournament.delete({ where: { id: testTournament.id } });
      }
      if (testQuiz?.id) {
        await prisma.quiz.delete({ where: { id: testQuiz.id } });
      }
      if (testUser?.id) {
        await prisma.user.delete({ where: { id: testUser.id } });
      }
    } catch (e) {
      console.error("Cleanup error:", e);
    }
    
    // Закрываем соединение с БД
    await prisma.$disconnect();
  });

  describe("Tournament Data Integrity", () => {
    test("турнир создан с правильными этапами", async () => {
      const tournament = await prisma.tournament.findUnique({
        where: { id: testTournament.id },
        include: { stages: { orderBy: { order: "asc" } } },
      });

      expect(tournament).not.toBeNull();
      expect(tournament!.stages).toHaveLength(2);
      expect(tournament!.stages[0].order).toBe(1);
      expect(tournament!.stages[1].order).toBe(2);
      expect(tournament!.stages[0].scoreMultiplier).toBe(1.0);
      expect(tournament!.stages[1].scoreMultiplier).toBe(1.5);
    });

    test("турнир имеет правильные призы", async () => {
      const tournament = await prisma.tournament.findUnique({
        where: { id: testTournament.id },
        include: { prizes: { orderBy: { place: "asc" } } },
      });

      expect(tournament!.prizes).toHaveLength(3);
      expect(tournament!.prizes[0].value).toBe(1000);
      expect(tournament!.prizes[1].value).toBe(500);
      expect(tournament!.prizes[2].value).toBe(250);
    });

    test("этапы связаны с квизом", async () => {
      const stages = await prisma.tournamentStage.findMany({
        where: { tournamentId: testTournament.id },
        include: { quiz: true },
      });

      stages.forEach((stage) => {
        expect(stage.quizId).toBe(testQuiz.id);
        expect(stage.quiz).not.toBeNull();
      });
    });
  });

  describe("Tournament Registration", () => {
    test("пользователь может зарегистрироваться на турнир", async () => {
      // Проверяем что XP достаточно
      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(user!.xp).toBeGreaterThanOrEqual(50);

      // Регистрируемся
      const participant = await prisma.tournamentParticipant.create({
        data: {
          tournamentId: testTournament.id,
          userId: testUser.id,
          status: "ACTIVE",
        },
      });

      expect(participant).not.toBeNull();
      expect(participant.status).toBe("ACTIVE");
      expect(participant.totalScore).toBe(0);
      expect(participant.currentStage).toBe(1);
    });

    test("нельзя зарегистрироваться дважды", async () => {
      await expect(
        prisma.tournamentParticipant.create({
          data: {
            tournamentId: testTournament.id,
            userId: testUser.id,
            status: "ACTIVE",
          },
        })
      ).rejects.toThrow();
    });
  });

  describe("Stage Progression", () => {
    test("можно записать результат первого этапа", async () => {
      const stages = await prisma.tournamentStage.findMany({
        where: { tournamentId: testTournament.id },
        orderBy: { order: "asc" },
      });

      const result = await prisma.tournamentStageResult.create({
        data: {
          stageId: stages[0].id,
          userId: testUser.id,
          score: 150,
          passed: true,
          completedAt: new Date(),
        },
      });

      expect(result.score).toBe(150);
      expect(result.passed).toBe(true);
    });

    test("общий счёт участника обновляется", async () => {
      const participant = await prisma.tournamentParticipant.update({
        where: {
          tournamentId_userId: {
            tournamentId: testTournament.id,
            userId: testUser.id,
          },
        },
        data: {
          totalScore: { increment: 150 },
          currentStage: 2,
        },
      });

      expect(participant.totalScore).toBe(150);
      expect(participant.currentStage).toBe(2);
    });

    test("можно записать результат второго этапа с множителем", async () => {
      const stages = await prisma.tournamentStage.findMany({
        where: { tournamentId: testTournament.id },
        orderBy: { order: "asc" },
      });

      const baseScore = 200;
      const multipliedScore = Math.round(baseScore * stages[1].scoreMultiplier);

      const result = await prisma.tournamentStageResult.create({
        data: {
          stageId: stages[1].id,
          userId: testUser.id,
          score: multipliedScore,
          passed: true,
          completedAt: new Date(),
        },
      });

      expect(result.score).toBe(300); // 200 * 1.5
    });
  });

  describe("Ranking System", () => {
    let secondUser: { id: number };

    beforeAll(async () => {
      // Создаём второго тестового пользователя
      secondUser = await prisma.user.create({
        data: {
          telegramId: `test_tournament_second_${Date.now()}`,
          username: "tournament_tester_2",
          xp: 500,
        },
      });

      // Регистрируем на турнир
      await prisma.tournamentParticipant.create({
        data: {
          tournamentId: testTournament.id,
          userId: secondUser.id,
          status: "ACTIVE",
          totalScore: 100, // Меньше чем у первого
        },
      });
    });

    afterAll(async () => {
      await prisma.tournamentParticipant.deleteMany({
        where: { userId: secondUser.id },
      });
      await prisma.user.delete({ where: { id: secondUser.id } });
    });

    test("ранки рассчитываются правильно", async () => {
      const participants = await prisma.tournamentParticipant.findMany({
        where: { tournamentId: testTournament.id },
        orderBy: { totalScore: "desc" },
      });

      // Обновляем ранки
      for (let i = 0; i < participants.length; i++) {
        await prisma.tournamentParticipant.update({
          where: { id: participants[i].id },
          data: { rank: i + 1 },
        });
      }

      const firstPlace = await prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId: testTournament.id,
            userId: testUser.id,
          },
        },
      });

      const secondPlace = await prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId: testTournament.id,
            userId: secondUser.id,
          },
        },
      });

      expect(firstPlace!.rank).toBe(1);
      expect(secondPlace!.rank).toBe(2);
      expect(firstPlace!.totalScore).toBeGreaterThan(secondPlace!.totalScore);
    });
  });

  describe("MinScore Validation", () => {
    test("этап с minScore 100 - прошёл при 150 очках", async () => {
      const stages = await prisma.tournamentStage.findMany({
        where: { tournamentId: testTournament.id },
        orderBy: { order: "asc" },
      });

      const score = 150;
      const passed = stages[0].minScore === null || score >= stages[0].minScore;

      expect(passed).toBe(true);
    });

    test("этап с minScore 100 - не прошёл при 50 очках", async () => {
      const stages = await prisma.tournamentStage.findMany({
        where: { tournamentId: testTournament.id },
        orderBy: { order: "asc" },
      });

      const score = 50;
      const passed = stages[0].minScore === null || score >= stages[0].minScore;

      expect(passed).toBe(false);
    });
  });

  describe("Tournament Status Transitions", () => {
    test("UPCOMING → ACTIVE при достижении startsAt", async () => {
      const upcomingTournament = await prisma.tournament.create({
        data: {
          slug: `upcoming-test-${Date.now()}`,
          title: "Upcoming Tournament",
          status: "UPCOMING",
          type: "QUIZ",
          startsAt: new Date(Date.now() - 1000), // Уже началось
          endsAt: new Date(Date.now() + 1000 * 60 * 60),
        },
      });

      // Симулируем обновление статуса
      const updated = await prisma.tournament.updateMany({
        where: {
          id: upcomingTournament.id,
          status: "UPCOMING",
          startsAt: { lte: new Date() },
        },
        data: { status: "ACTIVE" },
      });

      expect(updated.count).toBe(1);

      const tournament = await prisma.tournament.findUnique({
        where: { id: upcomingTournament.id },
      });
      expect(tournament!.status).toBe("ACTIVE");

      // Cleanup
      await prisma.tournament.delete({ where: { id: upcomingTournament.id } });
    });

    test("ACTIVE → FINISHED при достижении endsAt", async () => {
      const activeTournament = await prisma.tournament.create({
        data: {
          slug: `active-test-${Date.now()}`,
          title: "Active Tournament",
          status: "ACTIVE",
          type: "QUIZ",
          startsAt: new Date(Date.now() - 1000 * 60 * 60),
          endsAt: new Date(Date.now() - 1000), // Уже закончился
        },
      });

      // Симулируем обновление статуса
      const updated = await prisma.tournament.updateMany({
        where: {
          id: activeTournament.id,
          status: "ACTIVE",
          endsAt: { lte: new Date() },
        },
        data: { status: "FINISHED" },
      });

      expect(updated.count).toBe(1);

      const tournament = await prisma.tournament.findUnique({
        where: { id: activeTournament.id },
      });
      expect(tournament!.status).toBe("FINISHED");

      // Cleanup
      await prisma.tournament.delete({ where: { id: activeTournament.id } });
    });
  });

  describe("Cascade Deletes", () => {
    test("удаление турнира удаляет связанные данные", async () => {
      // Создаём турнир со всеми связями
      const cascadeTest = await prisma.tournament.create({
        data: {
          slug: `cascade-test-${Date.now()}`,
          title: "Cascade Test",
          status: "ACTIVE",
          type: "QUIZ",
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 1000 * 60 * 60),
          stages: {
            create: [{ order: 1, title: "Stage 1", type: "QUIZ" }],
          },
          prizes: {
            create: [{ place: 1, type: "XP", value: 100, title: "Test Prize" }],
          },
        },
        include: { stages: true, prizes: true },
      });

      const stageId = cascadeTest.stages[0].id;
      const prizeId = cascadeTest.prizes[0].id;

      // Удаляем турнир
      await prisma.tournament.delete({ where: { id: cascadeTest.id } });

      // Проверяем каскадное удаление
      const stage = await prisma.tournamentStage.findUnique({ where: { id: stageId } });
      const prize = await prisma.tournamentPrize.findUnique({ where: { id: prizeId } });

      expect(stage).toBeNull();
      expect(prize).toBeNull();
    });
  });
});
