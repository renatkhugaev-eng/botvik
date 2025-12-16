# Rive Particles Animation

## Текущий статус
⚠️ **TODO**: Добавить файл `particles.riv`

Компонент `ParticlesRiveLayer` автоматически проверяет наличие файла и не рендерится, если файл не найден.

## Как создать particles.riv

### Вариант 1: Rive Editor (рекомендуется)
1. Откройте https://rive.app/editor
2. Создайте новый файл
3. Добавьте несколько кругов/точек с:
   - Subtle opacity animation (0.3 → 0.8 → 0.3)
   - Y-axis drift (плавное движение вверх/вниз)
   - Random delays и durations
4. Добавьте State Machine с именем "State Machine 1"
5. Экспортируйте как `.riv`
6. Положите файл в `/public/rive/particles.riv`

### Вариант 2: Rive Community
1. Найдите готовый эффект на https://rive.app/community
2. Поиск: "particles", "dust", "sparkles", "ambient"
3. Скачайте `.riv` файл
4. Переименуйте в `particles.riv`
5. Положите в `/public/rive/`

### Вариант 3: Готовые ресурсы
- https://rive.app/community/6181-12367-particles/
- https://rive.app/community/5671-11211-dust-particles/

## Требования к анимации

1. **Artboard**: любой (компонент автоматически подстроит)
2. **State Machine**: "State Machine 1" (или укажите другое имя в props)
3. **Производительность**: ≤20 элементов, без blur/filter внутри Rive
4. **Цвета**: нейтральные (белый/серый с opacity) для совместимости с темным UI

## Использование компонента

```tsx
import { ParticlesRiveLayer } from "@/components/fx/ParticlesRiveLayer";
import { useScrollPerfMode } from "@/components/hooks/useScrollPerfMode";

function MyPage() {
  const isScrolling = useScrollPerfMode();
  
  return (
    <div className="relative">
      <ParticlesRiveLayer 
        pause={isScrolling}    // Пауза при скролле
        opacity={0.5}          // Прозрачность слоя
        src="/rive/particles.riv" // Путь к файлу (по умолчанию)
        stateMachine="State Machine 1" // Имя state machine
      />
      {/* Контент страницы */}
    </div>
  );
}
```

## Perf Mode CSS

Когда `isScrolling = true`, на контейнер добавляется класс `.perf`:

```css
/* В globals.css */
.perf .glass { backdrop-filter: none }
.perf .glow-violet { opacity: 0.15 }
.perf .animate-float { animation-play-state: paused }
```

Это временно отключает тяжелые эффекты во время скролла для плавной работы.

