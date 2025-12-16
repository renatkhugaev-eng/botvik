import sharp from 'sharp';
import { readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';

const ICONS_DIR = './public/icons';
const QUALITY = 80; // WebP quality (0-100)

async function convertToWebP() {
  const files = readdirSync(ICONS_DIR);
  const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));
  
  console.log(`Found ${pngFiles.length} PNG files to convert...`);
  
  let totalOriginal = 0;
  let totalConverted = 0;
  
  for (const file of pngFiles) {
    const inputPath = join(ICONS_DIR, file);
    const outputPath = join(ICONS_DIR, basename(file, extname(file)) + '.webp');
    
    const originalSize = statSync(inputPath).size;
    totalOriginal += originalSize;
    
    try {
      await sharp(inputPath)
        .webp({ quality: QUALITY })
        .toFile(outputPath);
      
      const newSize = statSync(outputPath).size;
      totalConverted += newSize;
      
      const savings = ((1 - newSize / originalSize) * 100).toFixed(1);
      console.log(`✓ ${file} → ${basename(outputPath)} (${(originalSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB, -${savings}%)`);
    } catch (err) {
      console.error(`✗ Failed to convert ${file}:`, err.message);
    }
  }
  
  console.log('\n─────────────────────────────────────');
  console.log(`Total: ${(totalOriginal/1024/1024).toFixed(2)}MB → ${(totalConverted/1024/1024).toFixed(2)}MB`);
  console.log(`Saved: ${((1 - totalConverted/totalOriginal) * 100).toFixed(1)}%`);
}

convertToWebP();

