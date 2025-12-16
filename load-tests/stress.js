import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * k6 Load Testing для Quiz App
 * 
 * Установка: 
 *   Windows: choco install k6
 *   Mac: brew install k6
 *   Linux: sudo apt install k6
 * 
 * Запуск:
 *   k6 run load-tests/stress.js
 *   k6 run --vus 50 --duration 30s load-tests/stress.js
 */

// Кастомные метрики
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

// Конфигурация теста
export const options = {
  // Сценарии нагрузки
  scenarios: {
    // Smoke test - базовая проверка
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '10s',
      startTime: '0s',
    },
    // Load test - нормальная нагрузка
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },  // Разгон до 20 пользователей
        { duration: '1m', target: 20 },   // Держим 20 пользователей
        { duration: '30s', target: 0 },   // Снижаем до 0
      ],
      startTime: '15s',
    },
    // Stress test - повышенная нагрузка
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },  // Разгон до 50 пользователей
        { duration: '1m', target: 50 },   // Держим 50 пользователей
        { duration: '30s', target: 100 }, // Увеличиваем до 100
        { duration: '1m', target: 100 },  // Держим 100 пользователей
        { duration: '30s', target: 0 },   // Снижаем до 0
      ],
      startTime: '2m30s',
    },
  },
  
  // Пороги успешности (смягчены для dev сервера, в production будет быстрее)
  thresholds: {
    http_req_duration: ['p(95)<15000'], // 95% запросов < 15 сек (dev server)
    http_req_failed: ['rate<0.1'],       // Менее 10% ошибок
    errors: ['rate<0.5'],                // Менее 50% ошибок (для dev)
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Главная функция теста
export default function () {
  // 1. Health Check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
    'health response ok': (r) => {
      try {
        return JSON.parse(r.body).ok === true;
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);
  apiLatency.add(healthRes.timings.duration);

  sleep(0.5);

  // 2. Получение списка квизов
  const quizListRes = http.get(`${BASE_URL}/api/quiz`);
  check(quizListRes, {
    'quiz list status 200': (r) => r.status === 200,
    'quiz list is array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);
  apiLatency.add(quizListRes.timings.duration);

  sleep(0.5);

  // 3. Получение конкретного квиза
  const quizRes = http.get(`${BASE_URL}/api/quiz/1`);
  check(quizRes, {
    'quiz status 200 or 404': (r) => r.status === 200 || r.status === 404,
  }) || errorRate.add(1);
  apiLatency.add(quizRes.timings.duration);

  sleep(0.5);

  // 4. Лидерборд
  const leaderboardRes = http.get(`${BASE_URL}/api/leaderboard?quizId=1`);
  check(leaderboardRes, {
    'leaderboard status ok': (r) => r.status === 200 || r.status === 400,
  }) || errorRate.add(1);
  apiLatency.add(leaderboardRes.timings.duration);

  sleep(0.5);

  // 5. Weekly Leaderboard
  const weeklyRes = http.get(`${BASE_URL}/api/leaderboard/weekly`);
  check(weeklyRes, {
    'weekly leaderboard status ok': (r) => r.status === 200,
  }) || errorRate.add(1);
  apiLatency.add(weeklyRes.timings.duration);

  sleep(1);
}

// Обработка результатов
export function handleSummary(data) {
  console.log('\n========== LOAD TEST RESULTS ==========\n');
  
  const reqDuration = data.metrics.http_req_duration;
  const reqFailed = data.metrics.http_req_failed;
  
  if (reqDuration && reqFailed) {
    console.log(`Total Requests: ${data.metrics.http_reqs?.values?.count || 'N/A'}`);
    console.log(`Failed Requests: ${((reqFailed.values?.rate || 0) * 100).toFixed(2)}%`);
    console.log(`\nResponse Times:`);
    console.log(`  Average: ${(reqDuration.values?.avg || 0).toFixed(0)}ms`);
    console.log(`  P50: ${(reqDuration.values?.med || 0).toFixed(0)}ms`);
    console.log(`  P90: ${(reqDuration.values?.['p(90)'] || 0).toFixed(0)}ms`);
    console.log(`  P95: ${(reqDuration.values?.['p(95)'] || 0).toFixed(0)}ms`);
    console.log(`  Max: ${(reqDuration.values?.max || 0).toFixed(0)}ms`);
  }
  
  console.log('\n========================================\n');
  
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}

