import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Soak Test - длительное тестирование на утечки памяти
 * 
 * Запуск: k6 run load-tests/soak.js
 * (занимает ~15 минут)
 */

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Разогрев
    { duration: '10m', target: 20 },  // Длительная нагрузка
    { duration: '1m', target: 0 },    // Остывание
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.05'], // Строже - менее 5% ошибок
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/api/quiz`);
  
  check(res, {
    'status 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}

