/**
 * Скрипт для автоматического анализа рамок и определения центра отверстия
 * 
 * Использование:
 *   npx ts-node scripts/analyze-frames.ts
 * 
 * Логика:
 *   1. Загружает каждый PNG из /public/frames
 *   2. Находит область прозрачности (отверстие для аватара)
 *   3. Вычисляет центр этого отверстия
 *   4. Рассчитывает нужный offset для идеального центрирования
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-совместимый способ получить __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FrameAnalysis {
  slug: string;
  imageSize: { width: number; height: number };
  holeCenter: { x: number; y: number };
  imageCenter: { x: number; y: number };
  holeDiameter: number;  // Диаметр отверстия в пикселях
  holeRatio: number;     // Отношение диаметра отверстия к размеру изображения
  recommendedMultiplier: number; // Рекомендуемый frameMultiplier
  offsetNeeded: { vertical: number; horizontal: number };
  offsetPercent: { vertical: number; horizontal: number };
}

async function analyzeFrame(filePath: string): Promise<FrameAnalysis> {
  const slug = path.basename(filePath, '.png');
  
  // Загружаем изображение
  const image = sharp(filePath);
  const metadata = await image.metadata();
  const { width = 0, height = 0 } = metadata;
  
  // Извлекаем сырые данные с альфа-каналом
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  // Находим центральное отверстие (не весь прозрачный фон!)
  // Стратегия: ищем прозрачные пиксели только в центральной области
  const centerX = info.width / 2;
  const centerY = info.height / 2;
  const searchRadius = info.width * 0.4; // Ищем в центральных 80% изображения
  
  const transparentPixels: { x: number; y: number }[] = [];
  
  // Сначала находим все прозрачные пиксели в центральной области
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      // Пропускаем пиксели далеко от центра
      if (distFromCenter > searchRadius) continue;
      
      // RGBA = 4 bytes per pixel
      const alphaIndex = (y * info.width + x) * 4 + 3;
      const alpha = data[alphaIndex];
      
      // Прозрачный пиксель (альфа < 50 из 255)
      if (alpha < 50) {
        transparentPixels.push({ x, y });
      }
    }
  }
  
  if (transparentPixels.length === 0) {
    console.warn(`⚠️  ${slug}: Не найдено прозрачных пикселей`);
    return {
      slug,
      imageSize: { width, height },
      holeCenter: { x: width / 2, y: height / 2 },
      imageCenter: { x: width / 2, y: height / 2 },
      holeDiameter: width * 0.54,
      holeRatio: 0.54,
      recommendedMultiplier: 1.85,
      offsetNeeded: { vertical: 0, horizontal: 0 },
      offsetPercent: { vertical: 0, horizontal: 0 },
    };
  }
  
  // Вычисляем центр масс прозрачной области (центр отверстия)
  let sumX = 0, sumY = 0;
  for (const p of transparentPixels) {
    sumX += p.x;
    sumY += p.y;
  }
  
  const holeCenterX = sumX / transparentPixels.length;
  const holeCenterY = sumY / transparentPixels.length;
  
  // Вычисляем диаметр отверстия (среднее расстояние от центра до краёв × 2)
  // Используем bounding box прозрачной области
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of transparentPixels) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  
  // Диаметр = среднее между шириной и высотой bounding box
  const holeWidth = maxX - minX;
  const holeHeight = maxY - minY;
  const holeDiameter = (holeWidth + holeHeight) / 2;
  
  // Отношение диаметра к размеру изображения
  const holeRatio = holeDiameter / width;
  
  // Рекомендуемый множитель: 1 / holeRatio (чтобы аватар заполнял отверстие)
  // Добавляем небольшой запас (0.95) чтобы аватар не вылезал за края
  const recommendedMultiplier = 1 / (holeRatio * 0.95);
  
  // Центр изображения
  const imageCenterX = width / 2;
  const imageCenterY = height / 2;
  
  // Смещение отверстия относительно центра изображения
  // Если отверстие выше центра (holeCenterY < imageCenterY), нужен положительный offset (опустить рамку)
  const offsetX = holeCenterX - imageCenterX; // положительное = отверстие правее центра
  const offsetY = holeCenterY - imageCenterY; // положительное = отверстие ниже центра
  
  // Конвертируем в проценты от размера аватара
  // frameMultiplier = 1.85, значит avatar size = width / 1.85
  const avatarSize = width / 1.85;
  
  // vertical offset: если отверстие выше центра (offsetY отрицательный), 
  // нужен положительный вертикальный offset чтобы опустить рамку
  const verticalPercent = -offsetY / avatarSize;
  const horizontalPercent = -offsetX / avatarSize;
  
  return {
    slug,
    imageSize: { width, height },
    holeCenter: { x: Math.round(holeCenterX), y: Math.round(holeCenterY) },
    imageCenter: { x: imageCenterX, y: imageCenterY },
    holeDiameter: Math.round(holeDiameter),
    holeRatio: Math.round(holeRatio * 100) / 100,
    recommendedMultiplier: Math.round(recommendedMultiplier * 100) / 100,
    offsetNeeded: { 
      vertical: Math.round(-offsetY), 
      horizontal: Math.round(-offsetX) 
    },
    offsetPercent: { 
      vertical: Math.round(verticalPercent * 100) / 100, 
      horizontal: Math.round(horizontalPercent * 100) / 100 
    },
  };
}

async function main() {
  const framesDir = path.join(__dirname, '..', 'public', 'frames');
  
  // Получаем все PNG файлы
  const files = fs.readdirSync(framesDir).filter(f => f.endsWith('.png'));
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   АНАЛИЗ РАМОК — Автоматическое определение центра отверстия');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const results: FrameAnalysis[] = [];
  
  for (const file of files) {
    const filePath = path.join(framesDir, file);
    const analysis = await analyzeFrame(filePath);
    results.push(analysis);
  }
  
  // Сортируем по имени
  results.sort((a, b) => a.slug.localeCompare(b.slug));
  
  // Выводим таблицу результатов с размерами отверстий
  console.log('┌─────────────┬────────────┬───────────┬─────────────┬──────────────────┐');
  console.log('│ Рамка       │ Ø отверстия│ Ratio     │ Multiplier  │ Offset (v / h)   │');
  console.log('├─────────────┼────────────┼───────────┼─────────────┼──────────────────┤');
  
  for (const r of results) {
    const slug = r.slug.padEnd(11);
    const diameter = `${r.holeDiameter}px`.padEnd(10);
    const ratio = r.holeRatio.toFixed(2).padEnd(9);
    const mult = r.recommendedMultiplier.toFixed(2).padEnd(11);
    const offset = `${r.offsetPercent.vertical.toFixed(2)} / ${r.offsetPercent.horizontal.toFixed(2)}`.padEnd(16);
    console.log(`│ ${slug} │ ${diameter} │ ${ratio} │ ${mult} │ ${offset} │`);
  }
  
  console.log('└─────────────┴────────────┴───────────┴─────────────┴──────────────────┘');
  
  // Вычисляем средний рекомендуемый множитель
  const avgMultiplier = results.reduce((sum, r) => sum + r.recommendedMultiplier, 0) / results.length;
  const minMultiplier = Math.min(...results.map(r => r.recommendedMultiplier));
  const maxMultiplier = Math.max(...results.map(r => r.recommendedMultiplier));
  
  console.log(`\n📊 Статистика по frameMultiplier:`);
  console.log(`   Минимум: ${minMultiplier.toFixed(2)}`);
  console.log(`   Максимум: ${maxMultiplier.toFixed(2)}`);
  console.log(`   Среднее: ${avgMultiplier.toFixed(2)}`);
  console.log(`   Текущее значение: 1.85`);
  
  if (Math.abs(avgMultiplier - 1.85) > 0.1) {
    console.log(`\n⚠️  Рекомендуется изменить frameMultiplier на ${avgMultiplier.toFixed(2)}`);
  } else {
    console.log(`\n✅ Текущий frameMultiplier (1.85) оптимален!`);
  }
  
  // Генерируем готовый код для вставки
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   ГОТОВЫЙ КОД ДЛЯ AvatarWithFrame.tsx:');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('const frameOffsets: Record<string, { vertical: number; horizontal: number }> = {');
  
  for (const r of results) {
    const v = r.offsetPercent.vertical.toFixed(2);
    const h = r.offsetPercent.horizontal.toFixed(2);
    console.log(`  ${r.slug}: { vertical: ${v}, horizontal: ${h} },`);
  }
  
  console.log('};');
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
