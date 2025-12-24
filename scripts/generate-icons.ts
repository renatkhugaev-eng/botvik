/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ICON GENERATION SCRIPT
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Converts SVG icons to PNG format for better compatibility.
 * 
 * Usage:
 *   npx ts-node scripts/generate-icons.ts
 * 
 * Requirements:
 *   - sharp (already in devDependencies)
 *   - Source SVG files in public/
 * 
 * Output:
 *   - public/og-image.png (1200x630)
 *   - public/apple-touch-icon.png (180x180)
 *   - public/favicon.ico (32x32)
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

interface IconConfig {
  input: string;
  output: string;
  width: number;
  height: number;
}

const icons: IconConfig[] = [
  {
    input: 'og-image.svg',
    output: 'og-image.png',
    width: 1200,
    height: 630,
  },
  {
    input: 'apple-touch-icon.svg',
    output: 'apple-touch-icon.png',
    width: 180,
    height: 180,
  },
  {
    input: 'icon.svg',
    output: 'favicon-32.png',
    width: 32,
    height: 32,
  },
  {
    input: 'icon.svg',
    output: 'favicon-16.png',
    width: 16,
    height: 16,
  },
];

async function generateIcons() {
  console.log('🎨 Generating icons...\n');

  for (const icon of icons) {
    const inputPath = path.join(PUBLIC_DIR, icon.input);
    const outputPath = path.join(PUBLIC_DIR, icon.output);

    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Skipping ${icon.input} (not found)`);
      continue;
    }

    try {
      await sharp(inputPath)
        .resize(icon.width, icon.height)
        .png()
        .toFile(outputPath);

      console.log(`✅ ${icon.output} (${icon.width}x${icon.height})`);
    } catch (error) {
      console.error(`❌ Failed to generate ${icon.output}:`, error);
    }
  }

  console.log('\n✨ Icon generation complete!');
  console.log('\nTo update metadata to use PNG files, edit app/layout.tsx');
}

generateIcons().catch(console.error);

