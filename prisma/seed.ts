import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

let prisma: PrismaClient | null = null;

async function clearData(prisma: PrismaClient) {
  // Order matters because of FK constraints
  await prisma.answer.deleteMany();
  await prisma.quizSession.deleteMany();
  await prisma.answerOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.leaderboardEntry.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.user.deleteMany();
}

async function createQuizWithQuestions(prisma: PrismaClient) {
  const quiz = await prisma.quiz.create({
    data: {
      title: "Трукрайм-викторина №1",
      description: "Проверь, насколько хорошо ты знаешь истории серийных убийц и расследований.",
      prizeTitle: "Личная консультация автора канала",
      prizeDescription: "Созвон и разбор любимого дела или кейса.",
      isActive: true,
    },
  });

  const questions = [
    {
      order: 1,
      text: "Кто считается одним из самых известных серийных убийц США под прозвищем 'Зодиаκ'?",
      options: [
        { text: "Личный состав ФБР", isCorrect: false },
        { text: "Неизвестный преступник, личность так и не установили", isCorrect: true },
        { text: "Тед Банди", isCorrect: false },
        { text: "Джеффри Дамер", isCorrect: false },
      ],
    },
    {
      order: 2,
      text: "Какой основной признак отличает серийного убийцу от массового?",
      options: [
        { text: "Количество жертв за один эпизод", isCorrect: true },
        { text: "Используемое оружие", isCorrect: false },
        { text: "Город, в котором он действует", isCorrect: false },
        { text: "Возраст преступника", isCorrect: false },
      ],
    },
    {
      order: 3,
      text: "Какую роль чаще всего играет 'охлаждающий период' у серийного убийцы?",
      options: [
        { text: "Полное прекращение преступной деятельности", isCorrect: false },
        { text: "Период между убийствами, когда напряжение снова нарастает", isCorrect: true },
        { text: "Время, когда он признаётся полиции", isCorrect: false },
        { text: "Отпуск, не связанный с преступлениями", isCorrect: false },
      ],
    },
    {
      order: 4,
      text: "Какой из этих элементов чаще всего присутствует в профайлинге преступника?",
      options: [
        { text: "Любимый цвет и знак зодиака", isCorrect: false },
        { text: "Поведенческий паттерн, триггеры, тип жертв", isCorrect: true },
        { text: "Рост и цвет волос", isCorrect: false },
        { text: "Наличие домашнего животного", isCorrect: false },
      ],
    },
    {
      order: 5,
      text: "Какую задачу в расследовании чаще всего решает психологический портрет?",
      options: [
        { text: "Точно называет имя преступника", isCorrect: false },
        { text: "Сужает круг подозреваемых по поведению и образу жизни", isCorrect: true },
        { text: "Определяет точное место следующего преступления", isCorrect: false },
        { text: "Выбирает присяжных для суда", isCorrect: false },
      ],
    },
  ];

  for (const q of questions) {
    await prisma.question.create({
      data: {
        quizId: quiz.id,
        text: q.text,
        order: q.order,
        answers: {
          create: q.options.map((opt) => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
          })),
        },
      },
    });
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set; cannot seed.");
  }

  console.log("Using DATABASE_URL:", databaseUrl);

  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  prisma = new PrismaClient({ adapter });

  await clearData(prisma);

  await prisma.user.create({
    data: {
      telegramId: "123456",
      username: "test_user",
      firstName: "Тест",
      lastName: "Пользователь",
    },
  });

  await createQuizWithQuestions(prisma);

  await prisma.$disconnect();
}

main()
  .then(() => {
    console.log("Seeding completed");
  })
  .catch(async (e) => {
    console.error("Seeding failed", e);
    if (prisma) {
      await prisma.$disconnect();
    }
    process.exit(1);
  });

