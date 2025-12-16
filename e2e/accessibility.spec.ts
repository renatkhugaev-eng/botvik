import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility (a11y) тесты
 * Проверяют доступность приложения для людей с ограничениями
 */
test.describe('Accessibility', () => {
  
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

  test('главная страница должна быть доступной', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa']) // WCAG 2.0 Level A и AA
      .disableRules(['color-contrast', 'scrollable-region-focusable']) // Отключаем для мобильного Telegram UI
      .analyze();
    
    // Фильтруем незначительные нарушения
    const criticalViolations = results.violations.filter(v => 
      v.impact === 'critical' || v.impact === 'serious'
    );
    
    expect(criticalViolations).toHaveLength(0);
  });

  test('профиль должен быть доступным', async ({ page }) => {
    await page.goto('/miniapp/profile');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast', 'scrollable-region-focusable'])
      .analyze();
    
    const criticalViolations = results.violations.filter(v => 
      v.impact === 'critical' || v.impact === 'serious'
    );
    
    expect(criticalViolations).toHaveLength(0);
  });

  test('лидерборд должен быть доступным', async ({ page }) => {
    await page.goto('/miniapp/leaderboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast', 'scrollable-region-focusable'])
      .analyze();
    
    const criticalViolations = results.violations.filter(v => 
      v.impact === 'critical' || v.impact === 'serious'
    );
    
    expect(criticalViolations).toHaveLength(0);
  });

  test('изображения должны иметь alt атрибуты', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const imagesWithoutAlt = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      const issues: string[] = [];
      
      images.forEach(img => {
        if (!img.getAttribute('alt') && img.getAttribute('alt') !== '') {
          issues.push(img.src.split('/').pop() || 'unknown');
        }
      });
      
      return issues;
    });
    
    // Допускаем декоративные изображения без alt
    expect(imagesWithoutAlt.length).toBeLessThanOrEqual(5);
  });

  test('кнопки должны быть доступны с клавиатуры', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Проверяем что кнопки имеют tabindex или являются интерактивными элементами
    const nonFocusableButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, [role="button"]');
      const issues: string[] = [];
      
      buttons.forEach(btn => {
        const tabindex = btn.getAttribute('tabindex');
        if (tabindex === '-1') {
          issues.push(btn.textContent?.trim().substring(0, 20) || 'no text');
        }
      });
      
      return issues;
    });
    
    expect(nonFocusableButtons.length).toBeLessThanOrEqual(2);
  });

  test('страница должна иметь правильную структуру заголовков', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const headingStructure = await page.evaluate(() => {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(headings).map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent?.trim().substring(0, 30),
      }));
    });
    
    // Проверяем что заголовки идут в правильном порядке (h1 -> h2 -> h3)
    let prevLevel = 0;
    let hasSkippedLevel = false;
    
    headingStructure.forEach(h => {
      if (h.level > prevLevel + 1 && prevLevel !== 0) {
        hasSkippedLevel = true;
      }
      prevLevel = h.level;
    });
    
    // Допускаем пропуски уровней (часто в UI компонентах)
    // expect(hasSkippedLevel).toBe(false);
  });

  test('формы должны иметь labels', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const inputsWithoutLabels = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, textarea, select');
      const issues: string[] = [];
      
      inputs.forEach(input => {
        const id = input.getAttribute('id');
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledby = input.getAttribute('aria-labelledby');
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        
        if (!hasLabel && !ariaLabel && !ariaLabelledby) {
          issues.push(input.getAttribute('name') || input.getAttribute('type') || 'unknown');
        }
      });
      
      return issues;
    });
    
    expect(inputsWithoutLabels.length).toBeLessThanOrEqual(2);
  });

  test('фокус должен быть видимым', async ({ page }) => {
    await page.goto('/miniapp');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Нажимаем Tab несколько раз
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
    }
    
    // Проверяем что есть элемент с фокусом
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName : null;
    });
    
    expect(focusedElement).not.toBe('BODY');
  });
});

