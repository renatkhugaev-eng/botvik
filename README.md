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

## Profile / Личный кабинет
- API: `GET /api/me/summary` — агрегированная статистика пользователя (попытки, сыгранные викторины, правильные ответы, общий счёт, лучшие результаты по викторинам, последняя сессия).
- UI: `/miniapp/profile` — профиль с аватаром, бейджем уровня, личной статистикой, лучшими результатами и последней игрой (есть переход “Играть ещё раз”).

## UI & Design
- Светлая игровая тема в стиле Duolingo / современных Telegram Mini Apps.
- Основной цвет — зелёный (#22C55E, hover #16A34A), фон #F3F4F6, панели белые с тонкой рамкой #E5E7EB и мягкой тенью `0 10px 30px rgba(15,23,42,0.06)`.
- Центрированный layout как экран мини-аппа; крупные округлые карточки и кнопки.
- Единый стиль для /miniapp, /miniapp/quiz/[id], /miniapp/leaderboard, /miniapp/profile.
- В квизе сохранены лёгкие анимации появления вопроса/ответов (framer-motion).

## Seeding
- `npm run prisma:seed` — очищает БД и создаёт тестовую викторину "Трукрайм-викторина №1" с вопросами и одним тестовым пользователем.
