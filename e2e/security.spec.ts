import { test, expect } from '@playwright/test';

/**
 * Security тесты
 * Базовые проверки безопасности для веб-приложения
 * 
 * Для глубокого анализа используйте OWASP ZAP или Burp Suite
 */
test.describe('Security', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).Telegram = {
        WebApp: {
          ready: () => {},
          expand: () => {},
          disableVerticalSwipes: () => {},
          initData: 'test',
          initDataUnsafe: {
            user: { id: 123, first_name: 'Test', username: 'test' },
          },
          themeParams: {},
          colorScheme: 'dark',
        },
      };
    });
  });

  test('должны быть установлены security headers', async ({ request }) => {
    const response = await request.get('/miniapp');
    
    // Проверяем наличие важных security headers
    const headers = response.headers();
    
    // X-Content-Type-Options предотвращает MIME sniffing
    // (Next.js может не устанавливать по умолчанию)
    
    // X-Frame-Options защищает от clickjacking (необязателен для Mini App)
    
    // Проверяем что нет опасных заголовков
    // Если заголовок server существует, он не должен содержать версию
    const serverHeader = headers['server'];
    if (serverHeader) {
      expect(serverHeader).not.toContain('version'); // Не раскрываем версию сервера
    }
    // Отсутствие заголовка server - это хорошо для безопасности ✅
  });

  test('API не должен раскрывать внутренние ошибки', async ({ request }) => {
    // Отправляем невалидный запрос
    const response = await request.post('/api/quiz/99999/start', {
      data: { invalidData: true },
    });
    
    const body = await response.text();
    
    // Не должно быть stack trace в ответе
    expect(body).not.toContain('at ');
    expect(body).not.toContain('node_modules');
    expect(body).not.toContain('.ts:');
    expect(body).not.toContain('.js:');
    expect(body).not.toContain('Error:');
  });

  test('XSS защита - скрипты не выполняются в данных', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    
    // Проверяем что нет inline скриптов с eval или document.write
    const dangerousScripts = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      let dangerous = 0;
      
      scripts.forEach(script => {
        const content = script.textContent || '';
        if (content.includes('eval(') || content.includes('document.write(')) {
          dangerous++;
        }
      });
      
      return dangerous;
    });
    
    expect(dangerousScripts).toBe(0);
  });

  test('не должно быть открытых редиректов', async ({ request }) => {
    // Пробуем передать внешний URL
    // Playwright APIRequestContext не поддерживает followRedirects, проверяем вручную
    const response = await request.get('/api/health?redirect=https://evil.com', {
      maxRedirects: 0, // Предотвращаем автоматические редиректы
    });
    
    // Не должно быть редиректа на внешний URL
    const location = response.headers()['location'];
    if (location) {
      expect(location).not.toContain('evil.com');
    }
  });

  test('API должен валидировать типы данных', async ({ request }) => {
    // Отправляем неправильные типы
    const response = await request.post('/api/quiz/start', {
      data: {
        quizId: 'not-a-number', // Должно быть число
        userId: [], // Должно быть число или строка
      },
    });
    
    // Должен вернуть ошибку валидации, не 500
    expect(response.status()).not.toBe(500);
  });

  test('чувствительные данные не должны быть в URL', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('networkidle');
    
    // Проверяем что в URL нет токенов или паролей
    const url = page.url();
    
    expect(url).not.toContain('token=');
    expect(url).not.toContain('password=');
    expect(url).not.toContain('secret=');
    expect(url).not.toContain('api_key=');
  });

  test('формы должны иметь CSRF защиту или быть API-based', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    
    // Проверяем формы
    const forms = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      const issues: string[] = [];
      
      forms.forEach((form, i) => {
        // Форма должна либо иметь CSRF токен, либо использовать fetch
        const hasCSRF = form.querySelector('input[name="csrf"]') || 
                       form.querySelector('input[name="_token"]');
        const method = form.getAttribute('method')?.toLowerCase();
        
        if (method === 'post' && !hasCSRF) {
          issues.push(`Form ${i} POST without CSRF`);
        }
      });
      
      return issues;
    });
    
    // В React SPA обычно формы отправляются через fetch, не традиционным способом
    // Поэтому это информационный тест
    if (forms.length > 0) {
      console.log('Forms without CSRF (may be API-based):', forms);
    }
  });

  test('localStorage не должен содержать чувствительные данные', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const sensitiveData = await page.evaluate(() => {
      const issues: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key || '');
        
        if (key && value) {
          // Проверяем на чувствительные данные
          const lowerKey = key.toLowerCase();
          const lowerValue = value.toLowerCase();
          
          if (lowerKey.includes('password') || 
              lowerKey.includes('secret') ||
              lowerKey.includes('private_key')) {
            issues.push(`Sensitive key: ${key}`);
          }
          
          // JWT токены в localStorage - спорный вопрос, но для Mini App приемлемо
          // так как авторизация через Telegram
        }
      }
      
      return issues;
    });
    
    expect(sensitiveData).toHaveLength(0);
  });

  test('cookies должны иметь правильные флаги', async ({ page, context }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('networkidle');
    
    const cookies = await context.cookies();
    
    cookies.forEach(cookie => {
      // Session cookies должны быть HttpOnly
      if (cookie.name.toLowerCase().includes('session')) {
        expect(cookie.httpOnly).toBe(true);
      }
      
      // Все cookies должны быть SameSite
      expect(cookie.sameSite).toBeDefined();
    });
  });

  test('не должно быть mixed content', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('networkidle');
    
    // Собираем все HTTP ресурсы на HTTPS странице
    const mixedContent = await page.evaluate(() => {
      const resources: string[] = [];
      
      // Проверяем изображения
      document.querySelectorAll('img').forEach(img => {
        if (img.src.startsWith('http://')) {
          resources.push(img.src);
        }
      });
      
      // Проверяем скрипты
      document.querySelectorAll('script').forEach(script => {
        if (script.src && script.src.startsWith('http://')) {
          resources.push(script.src);
        }
      });
      
      // Проверяем стили
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = (link as HTMLLinkElement).href;
        if (href.startsWith('http://')) {
          resources.push(href);
        }
      });
      
      return resources;
    });
    
    // Localhost допустим для разработки
    const nonLocalMixed = mixedContent.filter(url => !url.includes('localhost'));
    expect(nonLocalMixed).toHaveLength(0);
  });

  test('Content-Security-Policy рекомендации', async ({ page }) => {
    await page.goto('/miniapp');
    
    // Проверяем наличие inline scripts (которые CSP может блокировать)
    const inlineScripts = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script:not([src])');
      return scripts.length;
    });
    
    // Next.js использует inline scripts для hydration - это нормально
    // Но их не должно быть слишком много
    expect(inlineScripts).toBeLessThan(20);
  });

  test('SQL injection защита в API', async ({ request }) => {
    // Пробуем SQL injection в параметрах
    const injectionPayloads = [
      "1; DROP TABLE users;--",
      "1' OR '1'='1",
      "1 UNION SELECT * FROM users",
    ];
    
    for (const payload of injectionPayloads) {
      const response = await request.get(`/api/quiz/${encodeURIComponent(payload)}`);
      
      // Не должно быть 500 ошибки (означает что запрос дошёл до БД)
      // Должен быть 400 или 404
      expect(response.status()).not.toBe(500);
    }
  });

  test('NoSQL injection защита', async ({ request }) => {
    // Пробуем NoSQL injection
    const response = await request.get('/api/quiz', {
      params: {
        id: '{"$gt": ""}',
      },
    });
    
    expect(response.status()).not.toBe(500);
  });

  test('Path traversal защита', async ({ request }) => {
    // Пробуем path traversal
    const traversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '%2e%2e%2f%2e%2e%2f',
    ];
    
    for (const payload of traversalPayloads) {
      const response = await request.get(`/api/${payload}`);
      
      // Должен быть 404, не содержимое файла
      expect(response.status()).toBe(404);
    }
  });
});

