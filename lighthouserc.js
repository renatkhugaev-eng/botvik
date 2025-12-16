/**
 * Lighthouse CI Configuration
 * 
 * Установка: npm install -D @lhci/cli
 * Запуск: npx lhci autorun
 */

module.exports = {
  ci: {
    collect: {
      // URL для тестирования
      url: [
        'http://localhost:3000/miniapp',
        'http://localhost:3000/miniapp/profile',
        'http://localhost:3000/miniapp/leaderboard',
      ],
      // Количество прогонов для усреднения
      numberOfRuns: 3,
      // Настройки Chrome
      settings: {
        // Эмуляция мобильного устройства (как Telegram Mini App)
        preset: 'desktop',
        // Throttling для реалистичных условий
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
      },
      // Запуск dev сервера
      startServerCommand: 'npm run dev',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 30000,
    },
    
    assert: {
      // Пороги для assertions
      assertions: {
        // Performance
        'categories:performance': ['warn', { minScore: 0.7 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 3000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.25 }],
        'total-blocking-time': ['warn', { maxNumericValue: 500 }],
        
        // Accessibility
        'categories:accessibility': ['warn', { minScore: 0.8 }],
        
        // Best Practices
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        
        // SEO (меньше важно для Mini App)
        'categories:seo': ['warn', { minScore: 0.6 }],
      },
    },
    
    upload: {
      // Локальное хранение результатов
      target: 'filesystem',
      outputDir: './lighthouse-results',
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%',
    },
  },
};

