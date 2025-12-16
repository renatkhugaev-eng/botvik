# 🎮 Botvik — Telegram Quiz Mini App

Интерактивное quiz-приложение для Telegram с системой рейтингов, еженедельными соревнованиями и социальными функциями.

## 🚀 Технологии

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Neon Serverless)
- **Cache**: Upstash Redis (Rate Limiting)
- **Monitoring**: Sentry, PostHog, Vercel Analytics
- **Animations**: Framer Motion, Rive, Lottie

## 📋 Возможности

### 🎯 Quiz System
- Множественные квизы с разными темами
- Система сложности вопросов (1-3)
- Server-side time validation (защита от читерства)
- Streak bonuses за серии правильных ответов
- Attempt decay — уменьшение очков при повторных попытках

### 🏆 Scoring System
```
TotalScore = BestScore + ActivityBonus
ActivityBonus = min(GamesPlayed × 50, 500)
```
- Качество важнее количества (70-80% = лучший результат)
- Бонус за активность (до 500 очков за 10 игр)

### 📊 Leaderboard
- All-time рейтинг по квизам
- Еженедельные соревнования (сброс каждое воскресенье 23:59)
- Уведомления победителям

### ⚡ XP & Levels
- Очки опыта за правильные ответы
- Бонусы за streaks и daily play
- Система уровней с титулами

### 👥 Friends System
- Добавление друзей по username
- Pending/Accepted/Declined статусы
- Статистика друзей

### 🔔 Notifications
- Level up уведомления
- Daily reminders (если не играл)
- Weekly winner notifications
- Friend activity alerts

## 🛠️ Установка

```bash
# Клонировать репозиторий
git clone <repo-url>
cd botvik

# Установить зависимости
npm install

# Настроить переменные окружения
cp .env.example .env

# Сгенерировать Prisma client
npx prisma generate

# Запустить миграции
npx prisma migrate dev

# Запустить seed (тестовые данные)
npm run prisma:seed

# Запустить dev сервер
npm run dev
```

## ⚙️ Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# Telegram
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_BOT_NAME="your_bot"

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."

# Monitoring
NEXT_PUBLIC_SENTRY_DSN="..."
SENTRY_ORG="..."
SENTRY_PROJECT="..."
NEXT_PUBLIC_POSTHOG_KEY="..."
NEXT_PUBLIC_POSTHOG_HOST="..."

# Security
CRON_SECRET="..."
ADMIN_PASSWORD="..."
ADMIN_TELEGRAM_IDS="123456,789012"

# Development
NEXT_PUBLIC_ALLOW_DEV_NO_TELEGRAM="true"
BYPASS_LIMITS="true"
```

## 📁 Структура проекта

```
├── app/
│   ├── api/                    # API Routes
│   │   ├── auth/telegram/      # Telegram authentication
│   │   ├── quiz/[id]/          # Quiz endpoints (start, answer, finish)
│   │   ├── leaderboard/        # Leaderboard & weekly
│   │   ├── friends/            # Friends system
│   │   ├── cron/               # Scheduled jobs
│   │   └── admin/              # Admin panel API
│   ├── miniapp/                # Main app pages
│   │   ├── page.tsx            # Home screen
│   │   ├── quiz/[id]/          # Quiz play screen
│   │   ├── profile/            # User profile
│   │   └── leaderboard/        # Leaderboard screen
│   └── admin/                  # Admin panel
├── components/
│   ├── hooks/                  # Custom hooks
│   │   ├── useDeviceTier.ts    # Device performance detection
│   │   ├── useScrollPerfMode.ts # Scroll optimization
│   │   └── useDeferredRender.ts # Deferred rendering
│   ├── miniapp/                # Mini app components
│   ├── fx/                     # Visual effects (Rive, etc.)
│   └── debug/                  # Debug tools
├── lib/
│   ├── auth.ts                 # Authentication logic
│   ├── scoring.ts              # Scoring formulas
│   ├── xp.ts                   # XP & levels system
│   ├── notifications.ts        # Telegram notifications
│   ├── ratelimit.ts            # Rate limiting
│   └── prisma.ts               # Database client
└── prisma/
    ├── schema.prisma           # Database schema
    ├── migrations/             # SQL migrations
    └── seed.ts                 # Test data
```

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/telegram` | Authenticate with Telegram initData |

### Quiz
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/quiz` | List active quizzes |
| GET | `/api/quiz/[id]` | Get quiz details |
| POST | `/api/quiz/[id]/start` | Start quiz session |
| POST | `/api/quiz/[id]/answer` | Submit answer |
| POST | `/api/quiz/[id]/finish` | Finish session |
| POST | `/api/quiz/[id]/timeout` | Handle timeout |

### Leaderboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leaderboard?quizId=X` | Quiz leaderboard |
| GET | `/api/leaderboard/weekly` | Weekly competition |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/me/summary` | User statistics |

### Friends
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/friends?userId=X` | Get friends list |
| POST | `/api/friends` | Send friend request |
| PUT | `/api/friends` | Accept/decline request |
| DELETE | `/api/friends` | Remove friend |

### Cron Jobs (Vercel)
| Method | Endpoint | Schedule | Description |
|--------|----------|----------|-------------|
| POST | `/api/notifications/daily` | 0 18 * * * | Daily reminders |
| POST | `/api/cron/weekly-reset` | 59 23 * * 0 | Weekly competition reset |

## 🎨 Performance Optimizations

### Mobile (iOS/Android)
- `viewport-fit: cover` for iPhone notch
- `safe-area-inset-*` padding
- Android blur → box-shadow fallback
- Device tier detection (low/mid/high)
- Perf mode during scroll (disable expensive effects)

### Core Web Vitals
- `contain: layout` on components
- `width/height` on all images
- Skeleton loading states
- GPU-accelerated animations
- Question caching (5 min TTL)

### API Optimization
- User auth cache (5 min TTL)
- Rate limit local cache
- Batch database queries
- Prisma `$transaction` for atomicity

## 🔒 Security

- **Telegram initData validation** (HMAC-SHA256)
- **Server-side time** for quiz answers
- **Rate limiting** (6 different limiters)
- **Session ownership checks**
- **Unique constraints** for duplicate prevention

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📊 Monitoring

- **Sentry**: Error tracking + Session Replay
- **PostHog**: Analytics + Feature flags
- **Vercel Analytics**: Performance metrics
- **Vercel Speed Insights**: Core Web Vitals

## 🚀 Deployment

```bash
# Deploy to Vercel
npx vercel --prod
```

## 📝 Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run format       # Prettier
npm run prisma:seed  # Seed database
npm test             # Run tests
```

## 📄 License

MIT

---

Built with ❤️ for Telegram Mini Apps
