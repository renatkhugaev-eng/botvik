import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Spike Test - проверка поведения при резком скачке нагрузки
 * 
 * Запуск: k6 run load-tests/spike.js
 */

export const options = {
  stages: [
    { duration: '10s', target: 5 },    // Разогрев
    { duration: '5s', target: 100 },   // Резкий скачок до 100 пользователей
    { duration: '30s', target: 100 },  // Держим пик
    { duration: '5s', target: 5 },     // Резкое снижение
    { duration: '10s', target: 5 },    // Восстановление
    { duration: '5s', target: 0 },     // Завершение
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // При spike допускаем 5 сек
    http_req_failed: ['rate<0.3'],      // Допускаем до 30% ошибок при spike
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Основные API endpoints
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/health`],
    ['GET', `${BASE_URL}/api/quiz`],
    ['GET', `${BASE_URL}/api/leaderboard/weekly`],
  ]);

  responses.forEach((res, i) => {
    check(res, {
      [`request ${i} status ok`]: (r) => r.status < 500,
    });
  });

  sleep(0.1); // Минимальная пауза для агрессивной нагрузки
}

