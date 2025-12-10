# Mini App Starter (Next.js)

Минимальный стартовый проект на Next.js (App Router, TypeScript, Tailwind, ESLint + Prettier) для дальнейшего превращения в Telegram Mini App.

## Установка

```bash
npm install
```

## Запуск в dev-режиме

```bash
npm run dev
# по умолчанию: http://localhost:3000
```

## Проверка health-эндпоинта

```bash
curl http://localhost:3000/api/health
# ожидаемый ответ: {"ok":true}
```

## Полезное
- Alias `@/*` указывает на корень проекта (удобно для абсолютных импортов без `src/`).
- Форматирование: `npm run format`.
- Линт: `npm run lint`.

## Database
- Пример строки подключения: `postgresql://user:password@localhost:5432/dbname` (см. `.env` / `.env.example`).
- Генерация клиента: `npx prisma generate`.
- Миграции в dev: `npx prisma migrate dev` (перед запуском убедитесь, что `DATABASE_URL` указывает на доступную БД).

### Telegram
- `TELEGRAM_BOT_TOKEN` — токен бота.
- `TELEGRAM_BOT_NAME` — username бота (без @).

## Quiz & Leaderboard API
- `GET /api/quiz` — список активных викторин.
- `POST /api/quiz/[id]/start` — создать/получить сессию и отдать вопросы.
- `POST /api/quiz/[id]/answer` — отправить ответ, получить очки и текущий счёт.
- `POST /api/quiz/[id]/finish` — завершить сессию, обновить лидерборд.
- `GET /api/leaderboard?quizId=...` — топ-20 по очкам для викторины.

## Seeding
- `npm run prisma:seed` — очищает БД и создаёт тестовую викторину "Трукрайм-викторина №1" с вопросами и одним тестовым пользователем.
