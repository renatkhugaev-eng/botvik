/**
 * Скрипт конвертации аватарок NPC из JPG в WebP
 * Запуск: npx tsx scripts/convert-avatars.ts
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const SOURCE_DIR = 'c:\\Users\\User\\OneDrive\\Desktop\\avatars';
const TARGET_DIR = path.join(process.cwd(), 'public', 'avatars');

// Маппинг: исходное имя -> целевое имя
const AVATAR_MAPPING: Record<string, string> = {
  'SOROKIN.JPG': 'sorokin.webp',
  'GROMOV.JPG': 'gromov.webp',
  'TANYA_ZORKINA.JPG': 'tanya.webp',
  'CHERNOV.JPG': 'chernov.webp',
  'PRIEST.JPG': 'serafim.webp',
  'STOROZH.JPG': 'fyodor.webp',
  'DOCTOR_PSYHO.JPG': 'vera.webp',
  'ADMINISTRATORMANAGER.JPG': 'klava.webp',
  'SOLDAT.JPG': 'soldier.webp',
  'VODITEL_AVTOBUS.JPG': 'driver.webp',
};

async function convertAvatars() {
  console.log('🖼️  Конвертация аватарок NPC...\n');

  // Создаем целевую папку если не существует
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  let totalOriginalSize = 0;
  let totalConvertedSize = 0;

  for (const [source, target] of Object.entries(AVATAR_MAPPING)) {
    const sourcePath = path.join(SOURCE_DIR, source);
    const targetPath = path.join(TARGET_DIR, target);

    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️  Не найден: ${source}`);
      continue;
    }

    const originalSize = fs.statSync(sourcePath).size;
    totalOriginalSize += originalSize;

    await sharp(sourcePath)
      .resize(512, 512, { fit: 'cover', position: 'top' })
      .webp({ quality: 85 })
      .toFile(targetPath);

    const convertedSize = fs.statSync(targetPath).size;
    totalConvertedSize += convertedSize;

    const savings = ((1 - convertedSize / originalSize) * 100).toFixed(1);
    console.log(`✅ ${source.padEnd(30)} → ${target.padEnd(20)} (${formatSize(originalSize)} → ${formatSize(convertedSize)}, -${savings}%)`);
  }

  console.log('\n📊 Итого:');
  console.log(`   Исходный размер:    ${formatSize(totalOriginalSize)}`);
  console.log(`   Конвертированный:   ${formatSize(totalConvertedSize)}`);
  console.log(`   Экономия:           ${formatSize(totalOriginalSize - totalConvertedSize)} (${((1 - totalConvertedSize / totalOriginalSize) * 100).toFixed(1)}%)`);
  console.log(`\n✨ Аватарки сохранены в: ${TARGET_DIR}`);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

convertAvatars().catch(console.error);
