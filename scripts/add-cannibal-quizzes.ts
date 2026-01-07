/**
 * 5 квизов про каннибалов и некрофилов
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_gTMlpB0EKZx4@ep-lucky-glitter-ag0ay94m-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);

type Question = {
  text: string;
  difficulty: number; // 1-3
  answers: { text: string; isCorrect: boolean }[];
};

type QuizData = {
  title: string;
  description: string;
  prizeTitle: string;
  questions: Question[];
};

const QUIZZES: QuizData[] = [
  {
    title: "Джеффри Дамер: Милуокский монстр",
    description: "17 жертв, каннибализм, некрофилия. Один из самых известных серийных убийц США.",
    prizeTitle: "Знаток дела Дамера",
    questions: [
      {
        text: "Сколько жертв официально приписывают Джеффри Дамеру?",
        difficulty: 1,
        answers: [
          { text: "17", isCorrect: true },
          { text: "8", isCorrect: false },
          { text: "33", isCorrect: false },
          { text: "5", isCorrect: false }
        ]
      },
      {
        text: "Что Дамер делал с частями тел своих жертв?",
        difficulty: 1,
        answers: [
          { text: "Хранил в холодильнике и употреблял в пищу", isCorrect: true },
          { text: "Закапывал в лесу", isCorrect: false },
          { text: "Растворял в кислоте полностью", isCorrect: false },
          { text: "Сжигал", isCorrect: false }
        ]
      },
      {
        text: "Как полиция упустила возможность спасти 14-летнего Конерака Синтасомфона?",
        difficulty: 2,
        answers: [
          { text: "Вернули убегавшего мальчика Дамеру, поверив что это его парень", isCorrect: true },
          { text: "Не приехали на вызов", isCorrect: false },
          { text: "Арестовали не того человека", isCorrect: false },
          { text: "Мальчик отказался от помощи", isCorrect: false }
        ]
      },
      {
        text: "Чем Дамер пытался создать «зомби» из своих жертв?",
        difficulty: 3,
        answers: [
          { text: "Вливал кислоту в мозг через отверстие в черепе", isCorrect: true },
          { text: "Использовал электрошок", isCorrect: false },
          { text: "Давал сильные транквилизаторы", isCorrect: false },
          { text: "Применял гипноз", isCorrect: false }
        ]
      },
      {
        text: "Как погиб Джеффри Дамер?",
        difficulty: 1,
        answers: [
          { text: "Убит сокамерником в тюрьме", isCorrect: true },
          { text: "Казнён на электрическом стуле", isCorrect: false },
          { text: "Покончил с собой", isCorrect: false },
          { text: "Умер от болезни", isCorrect: false }
        ]
      },
      {
        text: "В каком году Дамер был арестован?",
        difficulty: 2,
        answers: [
          { text: "1991", isCorrect: true },
          { text: "1985", isCorrect: false },
          { text: "1978", isCorrect: false },
          { text: "1999", isCorrect: false }
        ]
      }
    ]
  },
  {
    title: "Андрей Чикатило: Ростовский потрошитель",
    description: "52 жертвы за 12 лет. Каннибал, насильник, учитель. Самый кровавый маньяк СССР.",
    prizeTitle: "Эксперт по делу Чикатило",
    questions: [
      {
        text: "Сколько убийств совершил Андрей Чикатило?",
        difficulty: 1,
        answers: [
          { text: "52 доказанных", isCorrect: true },
          { text: "17", isCorrect: false },
          { text: "100+", isCorrect: false },
          { text: "8", isCorrect: false }
        ]
      },
      {
        text: "Кем работал Чикатило?",
        difficulty: 1,
        answers: [
          { text: "Учителем русского языка и литературы", isCorrect: true },
          { text: "Врачом", isCorrect: false },
          { text: "Милиционером", isCorrect: false },
          { text: "Водителем", isCorrect: false }
        ]
      },
      {
        text: "Почему Чикатило отпустили после первого ареста в 1984?",
        difficulty: 2,
        answers: [
          { text: "Группа крови не совпала (редкий феномен — выделения отличались от крови)", isCorrect: true },
          { text: "У него было алиби", isCorrect: false },
          { text: "Свидетель отказался от показаний", isCorrect: false },
          { text: "Истёк срок задержания", isCorrect: false }
        ]
      },
      {
        text: "Какую часть тела Чикатило часто откусывал у жертв?",
        difficulty: 2,
        answers: [
          { text: "Язык и соски", isCorrect: true },
          { text: "Пальцы", isCorrect: false },
          { text: "Уши", isCorrect: false },
          { text: "Губы", isCorrect: false }
        ]
      },
      {
        text: "Как называлась операция по поимке Чикатило?",
        difficulty: 3,
        answers: [
          { text: "Операция «Лесополоса»", isCorrect: true },
          { text: "Операция «Маньяк»", isCorrect: false },
          { text: "Операция «Ростов»", isCorrect: false },
          { text: "Операция «Потрошитель»", isCorrect: false }
        ]
      },
      {
        text: "В каком году Чикатило был казнён?",
        difficulty: 2,
        answers: [
          { text: "1994", isCorrect: true },
          { text: "1992", isCorrect: false },
          { text: "1990", isCorrect: false },
          { text: "1996", isCorrect: false }
        ]
      }
    ]
  },
  {
    title: "Исээй Сагава: Каннибал на свободе",
    description: "Съел студентку в Париже и гуляет на свободе. Самый скандальный случай безнаказанности.",
    prizeTitle: "Знаток дела Сагавы",
    questions: [
      {
        text: "Какой национальности была жертва Исээя Сагавы?",
        difficulty: 1,
        answers: [
          { text: "Голландка", isCorrect: true },
          { text: "Француженка", isCorrect: false },
          { text: "Американка", isCorrect: false },
          { text: "Японка", isCorrect: false }
        ]
      },
      {
        text: "Почему Сагава избежал тюрьмы?",
        difficulty: 2,
        answers: [
          { text: "Признан невменяемым во Франции, депортирован в Японию", isCorrect: true },
          { text: "Доказательства были уничтожены", isCorrect: false },
          { text: "Свидетелей не было", isCorrect: false },
          { text: "Заплатил выкуп", isCorrect: false }
        ]
      },
      {
        text: "Чем занимался Сагава после освобождения в Японии?",
        difficulty: 2,
        answers: [
          { text: "Стал знаменитостью, писал книги и снимался в кино", isCorrect: true },
          { text: "Жил в изоляции", isCorrect: false },
          { text: "Работал врачом", isCorrect: false },
          { text: "Был под домашним арестом", isCorrect: false }
        ]
      },
      {
        text: "В каком году Сагава совершил убийство?",
        difficulty: 2,
        answers: [
          { text: "1981", isCorrect: true },
          { text: "1975", isCorrect: false },
          { text: "1990", isCorrect: false },
          { text: "1968", isCorrect: false }
        ]
      },
      {
        text: "Как Сагава заманил жертву к себе?",
        difficulty: 1,
        answers: [
          { text: "Пригласил помочь с переводом стихов", isCorrect: true },
          { text: "Похитил на улице", isCorrect: false },
          { text: "Они были парой", isCorrect: false },
          { text: "Познакомились в баре", isCorrect: false }
        ]
      }
    ]
  },
  {
    title: "Эд Гейн: Прототип Кожаного лица",
    description: "Мебель из костей, абажуры из кожи. Вдохновил создателей Психо, Техасской резни и Молчания ягнят.",
    prizeTitle: "Эксперт по Эду Гейну",
    questions: [
      {
        text: "Сколько убийств доказано за Эдом Гейном?",
        difficulty: 2,
        answers: [
          { text: "2 (остальные тела — из могил)", isCorrect: true },
          { text: "15", isCorrect: false },
          { text: "0 — только раскапывал могилы", isCorrect: false },
          { text: "8", isCorrect: false }
        ]
      },
      {
        text: "Что полиция нашла в доме Гейна?",
        difficulty: 1,
        answers: [
          { text: "Мебель и одежду из человеческих останков", isCorrect: true },
          { text: "Дневники с планами убийств", isCorrect: false },
          { text: "Тюрьму для жертв в подвале", isCorrect: false },
          { text: "Лабораторию с химикатами", isCorrect: false }
        ]
      },
      {
        text: "Зачем Гейн делал «костюм» из женской кожи?",
        difficulty: 2,
        answers: [
          { text: "Хотел стать женщиной — своей умершей матерью", isCorrect: true },
          { text: "Продавал на чёрном рынке", isCorrect: false },
          { text: "Для ритуалов", isCorrect: false },
          { text: "Для устрашения", isCorrect: false }
        ]
      },
      {
        text: "Какие фильмы вдохновлены Эдом Гейном?",
        difficulty: 1,
        answers: [
          { text: "Психо, Техасская резня бензопилой, Молчание ягнят", isCorrect: true },
          { text: "Пила, Хостел, Крик", isCorrect: false },
          { text: "Кошмар на улице Вязов, Пятница 13-е", isCorrect: false },
          { text: "Оно, Сияние", isCorrect: false }
        ]
      },
      {
        text: "Как умер Эд Гейн?",
        difficulty: 2,
        answers: [
          { text: "От рака в психиатрической больнице", isCorrect: true },
          { text: "Казнён", isCorrect: false },
          { text: "Убит в тюрьме", isCorrect: false },
          { text: "Покончил с собой", isCorrect: false }
        ]
      }
    ]
  },
  {
    title: "Малоизвестные каннибалы",
    description: "Арминь Майвес, Альберт Фиш, Николай Джумагалиев — о них знают немногие.",
    prizeTitle: "Знаток тёмных историй",
    questions: [
      {
        text: "Армин Майвес нашёл жертву, которая ДОБРОВОЛЬНО согласилась быть съеденной. Где он её нашёл?",
        difficulty: 2,
        answers: [
          { text: "На форуме каннибалов в интернете", isCorrect: true },
          { text: "В психиатрической клинике", isCorrect: false },
          { text: "Через газетное объявление", isCorrect: false },
          { text: "В секте", isCorrect: false }
        ]
      },
      {
        text: "Альберт Фиш отправлял родителям убитых детей письма с описанием каннибализма. Сколько ему было лет при аресте?",
        difficulty: 3,
        answers: [
          { text: "65 лет", isCorrect: true },
          { text: "45 лет", isCorrect: false },
          { text: "35 лет", isCorrect: false },
          { text: "55 лет", isCorrect: false }
        ]
      },
      {
        text: "Казахский маньяк Николай Джумагалиев имел кличку связанную с его зубами. Какую?",
        difficulty: 2,
        answers: [
          { text: "Металлические клыки", isCorrect: true },
          { text: "Золотой рот", isCorrect: false },
          { text: "Акула", isCorrect: false },
          { text: "Вампир", isCorrect: false }
        ]
      },
      {
        text: "Что сделал Армин Майвес с гениталиями жертвы перед убийством?",
        difficulty: 3,
        answers: [
          { text: "Отрезал и они вместе пытались их съесть", isCorrect: true },
          { text: "Ничего", isCorrect: false },
          { text: "Сохранил как трофей", isCorrect: false },
          { text: "Закопал отдельно", isCorrect: false }
        ]
      },
      {
        text: "Карл Денке из Германии (1920-е) кормил соседей мясом своих жертв. Кем он прикидывался?",
        difficulty: 3,
        answers: [
          { text: "Добрым органистом церкви", isCorrect: true },
          { text: "Врачом", isCorrect: false },
          { text: "Мясником", isCorrect: false },
          { text: "Бродягой", isCorrect: false }
        ]
      },
      {
        text: "Сколько игл обнаружили в теле Альберта Фиша на рентгене?",
        difficulty: 3,
        answers: [
          { text: "29 игл в паховой области", isCorrect: true },
          { text: "5 игл", isCorrect: false },
          { text: "Ни одной — это миф", isCorrect: false },
          { text: "Более 100", isCorrect: false }
        ]
      }
    ]
  }
];

async function main() {
  console.log("📡 Подключение к Neon...");
  console.log("🔪 Добавление квизов про каннибалов...\n");

  let created = 0;

  for (const quizData of QUIZZES) {
    // Проверяем существует ли
    const existing = await sql`SELECT id FROM "Quiz" WHERE title = ${quizData.title}`;
    
    if (existing.length > 0) {
      console.log(`⏭️  "${quizData.title}" — уже существует`);
      continue;
    }

    // Создаём квиз
    const quizResult = await sql`
      INSERT INTO "Quiz" (title, description, "prizeTitle", "isActive")
      VALUES (${quizData.title}, ${quizData.description}, ${quizData.prizeTitle}, true)
      RETURNING id
    `;
    
    const quizId = (quizResult[0] as { id: number }).id;

    // Добавляем вопросы
    for (let i = 0; i < quizData.questions.length; i++) {
      const q = quizData.questions[i];
      
      const questionResult = await sql`
        INSERT INTO "Question" ("quizId", text, "order", difficulty, "timeLimitSeconds")
        VALUES (${quizId}, ${q.text}, ${i + 1}, ${q.difficulty}, 15)
        RETURNING id
      `;
      
      const questionId = (questionResult[0] as { id: number }).id;

      // Добавляем ответы
      for (const a of q.answers) {
        await sql`
          INSERT INTO "AnswerOption" ("questionId", text, "isCorrect")
          VALUES (${questionId}, ${a.text}, ${a.isCorrect})
        `;
      }
    }

    console.log(`✅ #${quizId} "${quizData.title}" — создан (${quizData.questions.length} вопросов)`);
    created++;
  }

  // Статистика
  const stats = await sql`SELECT COUNT(*) as count FROM "Quiz" WHERE "isActive" = true`;
  console.log(`\n🩸 Готово! Создано: ${created}`);
  console.log(`📊 Всего активных квизов: ${(stats[0] as { count: number }).count}`);
}

main().catch(console.error);

