import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import * as fs from "fs";
import * as path from "path";

/**
 * Скрипт импорта квизов из JSON файлов
 * 
 * Использование:
 *   npx ts-node scripts/import-quizzes.ts                    # Импорт всех квизов
 *   npx ts-node scripts/import-quizzes.ts quiz-1.json        # Импорт одного квиза
 *   npx ts-node scripts/import-quizzes.ts --clear            # Очистить и импортировать
 */

interface QuizAnswer {
  text: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  text: string;
  difficulty?: number;
  timeLimitSeconds?: number;
  answers: QuizAnswer[];
}

interface QuizData {
  title: string;
  description?: string;
  prizeTitle: string;
  prizeDescription?: string;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
  questions: QuizQuestion[];
}

const CONTENT_DIR = path.join(process.cwd(), "content", "quizzes");

async function getPrismaClient(): Promise<PrismaClient> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

async function importQuiz(prisma: PrismaClient, data: QuizData, fileName: string): Promise<void> {
  console.log(`\n📦 Импорт: ${data.title}`);
  
  // Проверяем, существует ли квиз с таким названием
  const existing = await prisma.quiz.findFirst({
    where: { title: data.title },
  });

  if (existing) {
    console.log(`   ⚠️  Квиз "${data.title}" уже существует (ID: ${existing.id}). Пропускаем.`);
    console.log(`   💡 Используйте --clear для перезаписи или измените название.`);
    return;
  }

  // Валидация
  if (!data.questions || data.questions.length === 0) {
    console.error(`   ❌ Ошибка: В квизе нет вопросов`);
    return;
  }

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    const correctAnswers = q.answers.filter(a => a.isCorrect).length;
    
    if (correctAnswers !== 1) {
      console.error(`   ❌ Ошибка в вопросе ${i + 1}: должен быть ровно 1 правильный ответ (найдено: ${correctAnswers})`);
      return;
    }
  }

  // Создаём квиз
  const quiz = await prisma.quiz.create({
    data: {
      title: data.title,
      description: data.description || null,
      prizeTitle: data.prizeTitle,
      prizeDescription: data.prizeDescription || null,
      isActive: data.isActive ?? true,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
    },
  });

  console.log(`   ✅ Создан квиз ID: ${quiz.id}`);

  // Создаём вопросы
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    
    await prisma.question.create({
      data: {
        quizId: quiz.id,
        text: q.text,
        order: i + 1,
        difficulty: q.difficulty || 1,
        timeLimitSeconds: q.timeLimitSeconds || 30,
        answers: {
          create: q.answers.map(a => ({
            text: a.text,
            isCorrect: a.isCorrect,
          })),
        },
      },
    });
  }

  console.log(`   ✅ Добавлено ${data.questions.length} вопросов`);
}

async function clearAllQuizzes(prisma: PrismaClient): Promise<void> {
  console.log("\n🗑️  Очистка существующих данных...");
  
  await prisma.answer.deleteMany();
  await prisma.quizSession.deleteMany();
  await prisma.answerOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.leaderboardEntry.deleteMany();
  await prisma.quiz.deleteMany();
  
  console.log("   ✅ Данные очищены");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldClear = args.includes("--clear");
  const specificFile = args.find(a => a.endsWith(".json"));

  console.log("🎯 Импорт квизов из JSON файлов");
  console.log(`   Директория: ${CONTENT_DIR}`);

  // Проверяем существование директории
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`❌ Директория не найдена: ${CONTENT_DIR}`);
    console.log("   Создайте папку content/quizzes/ и добавьте JSON файлы с квизами.");
    process.exit(1);
  }

  const prisma = await getPrismaClient();

  try {
    if (shouldClear) {
      await clearAllQuizzes(prisma);
    }

    // Получаем список файлов
    let files: string[];
    
    if (specificFile) {
      files = [specificFile];
    } else {
      files = fs.readdirSync(CONTENT_DIR)
        .filter(f => f.endsWith(".json") && !f.startsWith("_"));
    }

    if (files.length === 0) {
      console.log("\n⚠️  Не найдено JSON файлов для импорта");
      console.log("   Создайте файлы в content/quizzes/ (см. _template.json)");
      return;
    }

    console.log(`\n📂 Найдено файлов: ${files.length}`);

    let imported = 0;
    let skipped = 0;

    for (const file of files) {
      const filePath = path.join(CONTENT_DIR, file);
      
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const data: QuizData = JSON.parse(content);
        
        await importQuiz(prisma, data, file);
        imported++;
      } catch (error) {
        console.error(`\n❌ Ошибка в файле ${file}:`, error);
        skipped++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`✅ Импортировано: ${imported}`);
    if (skipped > 0) {
      console.log(`⚠️  Пропущено: ${skipped}`);
    }

    // Показываем статистику
    const quizCount = await prisma.quiz.count();
    const questionCount = await prisma.question.count();
    
    console.log("\n📊 Статистика базы данных:");
    console.log(`   Квизов: ${quizCount}`);
    console.log(`   Вопросов: ${questionCount}`);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);

