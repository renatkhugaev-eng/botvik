/**
 * Скрипт для добавления дополнительных квизов
 * 
 * Запуск: npx ts-node scripts/seed-quizzes.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

let prisma: PrismaClient | null = null;

interface QuizData {
  title: string;
  description: string;
  prizeTitle: string;
  prizeDescription?: string;
  questions: {
    text: string;
    options: { text: string; isCorrect: boolean }[];
  }[];
}

const QUIZZES: QuizData[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // КВИЗ 2: Громкие дела
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Громкие дела 20 века",
    description: "Знаменитые преступления и расследования, которые потрясли мир.",
    prizeTitle: "",
    prizeDescription: undefined,
    questions: [
      {
        text: "Какое прозвище получил убийца, терроризировавший Лондон в 1888 году?",
        options: [
          { text: "Джек Потрошитель", isCorrect: true },
          { text: "Душитель из Бостона", isCorrect: false },
          { text: "Ночной Сталкер", isCorrect: false },
          { text: "Кливлендский торс", isCorrect: false },
        ],
      },
      {
        text: "Какое дело считается одним из первых, где ДНК-анализ помог найти преступника?",
        options: [
          { text: "Дело Колина Питчфорка (1986)", isCorrect: true },
          { text: "Дело Теда Банди (1978)", isCorrect: false },
          { text: "Дело О. Джей Симпсона (1994)", isCorrect: false },
          { text: "Дело Зодиака (1969)", isCorrect: false },
        ],
      },
      {
        text: "Как называлась операция ФБР по поимке мафиози в 1970-80х?",
        options: [
          { text: "Операция ABSCAM", isCorrect: true },
          { text: "Операция Чистые Руки", isCorrect: false },
          { text: "Операция Underworld", isCorrect: false },
          { text: "Проект Максимус", isCorrect: false },
        ],
      },
      {
        text: "Кто был последним казнённым преступником в СССР?",
        options: [
          { text: "Чикатило", isCorrect: false },
          { text: "Серийный убийца из Узбекистана", isCorrect: false },
          { text: "Экономический преступник Ахмат Кадыров", isCorrect: false },
          { text: "Серийный убийца Андрей Романович Чикатило", isCorrect: true },
        ],
      },
      {
        text: "Какой метод впервые использовал Эдмон Локар для раскрытия преступлений?",
        options: [
          { text: "Принцип обмена (следы преступника)", isCorrect: true },
          { text: "Гипноз свидетелей", isCorrect: false },
          { text: "Детектор лжи", isCorrect: false },
          { text: "Криминальное профилирование", isCorrect: false },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // КВИЗ 3: Криминалистика
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Криминалистика: наука раскрытия",
    description: "Методы и технологии, которые помогают ловить преступников.",
    prizeTitle: "",
    prizeDescription: undefined,
    questions: [
      {
        text: "Какой орган человека оставляет самые уникальные отпечатки?",
        options: [
          { text: "Язык", isCorrect: true },
          { text: "Пальцы рук", isCorrect: false },
          { text: "Сетчатка глаза", isCorrect: false },
          { text: "Ухо", isCorrect: false },
        ],
      },
      {
        text: "Что такое люминол и для чего его используют?",
        options: [
          { text: "Реагент для обнаружения следов крови", isCorrect: true },
          { text: "Препарат для допроса", isCorrect: false },
          { text: "Маркер для денежных купюр", isCorrect: false },
          { text: "Средство для снятия отпечатков", isCorrect: false },
        ],
      },
      {
        text: "Какая часть тела разлагается последней?",
        options: [
          { text: "Зубы", isCorrect: true },
          { text: "Кости черепа", isCorrect: false },
          { text: "Волосы", isCorrect: false },
          { text: "Ногти", isCorrect: false },
        ],
      },
      {
        text: "Что изучает энтомология в криминалистике?",
        options: [
          { text: "Насекомых для определения времени смерти", isCorrect: true },
          { text: "Почву с места преступления", isCorrect: false },
          { text: "Психологию преступника", isCorrect: false },
          { text: "Следы обуви", isCorrect: false },
        ],
      },
      {
        text: "Какой газ выделяется при разложении тела и помогает его найти?",
        options: [
          { text: "Сероводород и аммиак", isCorrect: true },
          { text: "Углекислый газ", isCorrect: false },
          { text: "Метан", isCorrect: false },
          { text: "Азот", isCorrect: false },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // КВИЗ 4: Психология преступника
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Психология преступника",
    description: "Что творится в голове у тех, кто переступает черту.",
    prizeTitle: "Эксклюзивный бейдж",
    prizeDescription: "Бейдж 'Профайлер' в вашем профиле.",
    questions: [
      {
        text: "Какой тип личности чаще всего встречается среди серийных убийц?",
        options: [
          { text: "Антисоциальное расстройство личности", isCorrect: true },
          { text: "Биполярное расстройство", isCorrect: false },
          { text: "Шизофрения", isCorrect: false },
          { text: "Тревожное расстройство", isCorrect: false },
        ],
      },
      {
        text: "Что такое 'триада Макдональда' в криминальной психологии?",
        options: [
          { text: "Жестокость к животным, поджоги, энурез", isCorrect: true },
          { text: "Воровство, ложь, манипуляции", isCorrect: false },
          { text: "Употребление наркотиков, алкоголя, азартные игры", isCorrect: false },
          { text: "Детская травма, развод родителей, насилие", isCorrect: false },
        ],
      },
      {
        text: "Какой мотив самый распространённый у серийных убийц?",
        options: [
          { text: "Сексуальные фантазии и власть", isCorrect: true },
          { text: "Финансовая выгода", isCorrect: false },
          { text: "Месть обществу", isCorrect: false },
          { text: "Психоз", isCorrect: false },
        ],
      },
      {
        text: "Что означает термин 'cooling-off period'?",
        options: [
          { text: "Период между преступлениями серийного убийцы", isCorrect: true },
          { text: "Время, которое тратит полиция на расследование", isCorrect: false },
          { text: "Заморозка дела из-за нехватки улик", isCorrect: false },
          { text: "Период реабилитации заключённого", isCorrect: false },
        ],
      },
      {
        text: "Какой процент серийных убийц — мужчины?",
        options: [
          { text: "Около 90%", isCorrect: true },
          { text: "Около 50%", isCorrect: false },
          { text: "Около 70%", isCorrect: false },
          { text: "Около 60%", isCorrect: false },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // КВИЗ 5: Мафия и организованная преступность
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Мафия: история и структура",
    description: "Всё о крупнейших криминальных синдикатах мира.",
    prizeTitle: "",
    prizeDescription: undefined,
    questions: [
      {
        text: "Как называется обет молчания в итальянской мафии?",
        options: [
          { text: "Омерта", isCorrect: true },
          { text: "Вендетта", isCorrect: false },
          { text: "Капореджиме", isCorrect: false },
          { text: "Коза Ностра", isCorrect: false },
        ],
      },
      {
        text: "Кто был самым влиятельным боссом Коза Ностры в США?",
        options: [
          { text: "Карло Гамбино", isCorrect: true },
          { text: "Аль Капоне", isCorrect: false },
          { text: "Лаки Лучано", isCorrect: false },
          { text: "Джон Готти", isCorrect: false },
        ],
      },
      {
        text: "Какая японская организованная преступность известна своими татуировками?",
        options: [
          { text: "Якудза", isCorrect: true },
          { text: "Триады", isCorrect: false },
          { text: "Братство Солнца", isCorrect: false },
          { text: "Тонг", isCorrect: false },
        ],
      },
      {
        text: "За что был осуждён Аль Капоне?",
        options: [
          { text: "Уклонение от уплаты налогов", isCorrect: true },
          { text: "Убийство", isCorrect: false },
          { text: "Незаконный оборот алкоголя", isCorrect: false },
          { text: "Рэкет", isCorrect: false },
        ],
      },
      {
        text: "Какой город был центром русской мафии в США в 1990х?",
        options: [
          { text: "Брайтон-Бич, Нью-Йорк", isCorrect: true },
          { text: "Лос-Анджелес", isCorrect: false },
          { text: "Чикаго", isCorrect: false },
          { text: "Майами", isCorrect: false },
        ],
      },
    ],
  },
];

async function seedQuizzes(prisma: PrismaClient) {
  console.log("🎮 Добавляем квизы...\n");

  for (const quizData of QUIZZES) {
    // Проверяем, не существует ли уже такой квиз
    const existing = await prisma.quiz.findFirst({
      where: { title: quizData.title },
    });

    if (existing) {
      console.log(`⏩ Квиз "${quizData.title}" уже существует, пропускаем.`);
      continue;
    }

    // Создаём квиз
    const quiz = await prisma.quiz.create({
      data: {
        title: quizData.title,
        description: quizData.description,
        prizeTitle: quizData.prizeTitle || "",
        prizeDescription: quizData.prizeDescription,
        isActive: true,
      },
    });

    // Создаём вопросы
    for (let i = 0; i < quizData.questions.length; i++) {
      const q = quizData.questions[i];
      await prisma.question.create({
        data: {
          quizId: quiz.id,
          text: q.text,
          order: i + 1,
          answers: {
            create: q.options.map((opt) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
            })),
          },
        },
      });
    }

    console.log(`✅ Создан квиз: "${quizData.title}" (${quizData.questions.length} вопросов)`);
  }

  console.log("\n🎉 Готово!");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set; cannot seed.");
  }

  console.log("🔗 Подключение к базе данных...\n");

  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  prisma = new PrismaClient({ adapter });

  await seedQuizzes(prisma);

  await prisma.$disconnect();
}

main()
  .then(() => {
    console.log("\n✅ Seeding completed");
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("\n❌ Seeding failed:", e);
    if (prisma) {
      await prisma.$disconnect();
    }
    process.exit(1);
  });

