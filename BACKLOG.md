# Botvik Backlog

Technical debt and future improvements tracked from codebase audit.

## High Priority

### 🔐 Security

- [ ] Add CSRF protection for state-changing operations
- [ ] Implement request signing for sensitive endpoints

### ⚡ Performance

- [ ] Add Redis caching for leaderboard queries
- [ ] Implement edge caching for static quiz data
- [ ] Add bundle analyzer to CI pipeline

## Medium Priority

### 🎮 Investigations

- [ ] **STARS unlock**: Implement Telegram Stars purchase verification for investigations
  - Location: `app/api/investigations/route.ts`
  - Pattern: Follow `app/api/shop/purchase/route.ts`

- [ ] **Achievement unlock**: Implement achievement-based investigation unlock
  - Location: `app/api/investigations/route.ts`
  - Related: `lib/achievement-checker.ts`

- [ ] **Unlock verification**: Add proper unlock verification before starting investigation
  - Location: `app/api/investigations/[slug]/start/route.ts`

### 🎯 Features

- [ ] Show in-app notifications for discovered insights in investigations
  - Location: `app/miniapp/investigation/page.tsx`

## Low Priority

### 📝 Code Quality

- [ ] Add more E2E tests for duel flow
- [ ] Add integration tests for payment webhooks
- [ ] Consider removing unused `QuizIcons.tsx` or integrate into UI

### 📊 Analytics

- [ ] Add more granular PostHog events for investigation progress
- [ ] Track quiz abandonment rates

---

*Last updated: 2025-12-24*
*Generated from codebase audit*

