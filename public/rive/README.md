# Rive Particles Animation

## Требуется файл: `particles.riv`

Этот файл нужен для фоновой анимации частиц в приложении.

---

## Как получить файл:

### Вариант 1: Rive Community (рекомендуется)

1. Перейти на **https://rive.app/community/**
2. Искать по запросам:
   - `particles`
   - `floating dots`
   - `dust`
   - `sparkles`
   - `ambient`
   - `bokeh`

3. **Рекомендуемые файлы** (проверь доступность):
   - https://rive.app/community/3315-6723-particles/
   - https://rive.app/community/2481-4939-floating-particles/
   - https://rive.app/community/4567-9123-dust-particles/

4. Нажать **"Open in Rive"** → **File → Download → .riv**

---

### Вариант 2: Создать свой в Rive Editor

1. Перейти на **https://rive.app/**
2. Создать новый файл
3. Добавить 10-20 маленьких кругов/эллипсов (2-6px)
4. Цвета: белый/серый с opacity 20-60%
5. Анимировать плавное движение вверх-вниз, влево-вправо
6. Назвать State Machine: `State Machine 1`
7. Export → Download .riv

---

## Требования к файлу:

| Параметр | Значение |
|----------|----------|
| **Количество частиц** | ≤ 20 элементов |
| **Анимация** | Бесконечный loop |
| **Цвета** | Нейтральные (white/gray) с opacity |
| **Размер файла** | < 50KB |
| **State Machine** | `State Machine 1` |
| **Без blur/glow** | Все эффекты внутри Rive, не DOM |

---

## Проверка:

После добавления файла:

1. Файл лежит: `public/rive/particles.riv`
2. Размер > 100 байт (не placeholder)
3. Приложение отображает частицы на фоне
4. FPS не падает при скролле (pause работает)
5. На low-tier устройствах opacity ниже

---

## Лицензия:

Если файл из Rive Community требует атрибуции, укажите здесь:

- **Автор**: _____
- **Источник**: _____
- **Лицензия**: _____

---

## Текущий статус:

✅ **Файл добавлен** — `particles.riv` (wave-form animation)

- **Источник**: Rive Community
- **ID**: 4533-9212-wave-form
