/**
 * Оптимизация рамок для магазина
 * 
 * 1. Конвертирует PNG → WebP (экономия 60-80%)
 * 2. Создаёт thumbnails для превью в магазине
 * 
 * Запуск: node scripts/optimize-frames.mjs
 */

import sharp from 'sharp';
import { readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const FRAMES_DIR = './public/frames';
const THUMBS_DIR = './public/frames/thumbs';
const WEBP_QUALITY = 85;
const THUMB_SIZE = 256; // px — достаточно для превью в магазине

async function optimizeFrames() {
  // Создаём папку для thumbnails
  if (!existsSync(THUMBS_DIR)) {
    mkdirSync(THUMBS_DIR, { recursive: true });
    console.log(`📁 Created ${THUMBS_DIR}`);
  }

  const files = readdirSync(FRAMES_DIR);
  const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   ОПТИМИЗАЦИЯ РАМОК');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Найдено ${pngFiles.length} PNG файлов\n`);
  
  let stats = {
    originalTotal: 0,
    webpTotal: 0,
    thumbsTotal: 0,
  };
  
  for (const file of pngFiles) {
    const inputPath = join(FRAMES_DIR, file);
    const name = basename(file, extname(file));
    
    const originalSize = statSync(inputPath).size;
    stats.originalTotal += originalSize;
    
    try {
      // 1. Создаём WebP полного размера
      const webpPath = join(FRAMES_DIR, `${name}.webp`);
      await sharp(inputPath)
        .webp({ quality: WEBP_QUALITY })
        .toFile(webpPath);
      
      const webpSize = statSync(webpPath).size;
      stats.webpTotal += webpSize;
      
      // 2. Создаём thumbnail (маленький WebP для превью)
      const thumbPath = join(THUMBS_DIR, `${name}.webp`);
      await sharp(inputPath)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: WEBP_QUALITY })
        .toFile(thumbPath);
      
      const thumbSize = statSync(thumbPath).size;
      stats.thumbsTotal += thumbSize;
      
      // Вывод результата
      const webpSavings = ((1 - webpSize / originalSize) * 100).toFixed(0);
      const thumbSavings = ((1 - thumbSize / originalSize) * 100).toFixed(0);
      
      console.log(`✓ ${file.padEnd(15)} ${(originalSize/1024).toFixed(0).padStart(4)}KB → WebP: ${(webpSize/1024).toFixed(0).padStart(3)}KB (-${webpSavings}%) | Thumb: ${(thumbSize/1024).toFixed(0).padStart(2)}KB (-${thumbSavings}%)`);
      
    } catch (err) {
      console.error(`✗ Ошибка ${file}:`, err.message);
    }
  }
  
  // Итоги
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   ИТОГИ');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const originalMB = (stats.originalTotal / 1024 / 1024).toFixed(2);
  const webpMB = (stats.webpTotal / 1024 / 1024).toFixed(2);
  const thumbsMB = (stats.thumbsTotal / 1024 / 1024).toFixed(2);
  
  console.log(`📦 Оригиналы PNG:     ${originalMB} MB`);
  console.log(`🖼️  WebP полные:       ${webpMB} MB (экономия ${((1 - stats.webpTotal/stats.originalTotal) * 100).toFixed(0)}%)`);
  console.log(`🔍 Thumbnails:        ${thumbsMB} MB (экономия ${((1 - stats.thumbsTotal/stats.originalTotal) * 100).toFixed(0)}%)`);
  
  console.log('\n✅ Для магазина используйте thumbnails: /frames/thumbs/{name}.webp');
  console.log('✅ Для профиля используйте полные WebP: /frames/{name}.webp\n');
}

optimizeFrames().catch(console.error);
