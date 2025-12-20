import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const quizzes = await prisma.quiz.findMany({
    where: { id: { in: [14, 15, 6] } },
    include: {
      questions: {
        include: { answers: true },
        orderBy: { order: "asc" },
      },
    },
  });
  
  for (const quiz of quizzes) {
    console.log(`\n═══ QUIZ ${quiz.id}: ${quiz.title} ═══`);
    console.log(`Вопросов: ${quiz.questions.length}`);
    for (const q of quiz.questions) {
      console.log(`\n  Q${q.order}: ${q.text}`);
      for (const a of q.answers) {
        console.log(`    ${a.isCorrect ? "✅" : "  "} ${a.text}`);
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
