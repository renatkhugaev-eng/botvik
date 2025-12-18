/**
 * Seed script for cosmetic frames
 * Run: npx tsx scripts/seed-frames.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaNeon({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

interface FrameData {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  priceStars: number;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
}

const FRAMES: FrameData[] = [
  // ═══ COMMON (1-5 Stars) ═══
  {
    slug: "frame-basic-gold",
    title: "Золотая рамка",
    description: "Классическая золотая окантовка",
    imageUrl: "/frames/basic-gold.png",
    priceStars: 1,
    rarity: "COMMON",
  },
  {
    slug: "frame-basic-silver",
    title: "Серебряная рамка",
    description: "Элегантная серебряная окантовка",
    imageUrl: "/frames/basic-silver.png",
    priceStars: 1,
    rarity: "COMMON",
  },
  {
    slug: "frame-neon-blue",
    title: "Неоновая синяя",
    description: "Светящаяся синим неоном",
    imageUrl: "/frames/neon-blue.png",
    priceStars: 3,
    rarity: "COMMON",
  },
  {
    slug: "frame-neon-pink",
    title: "Неоновая розовая",
    description: "Светящаяся розовым неоном",
    imageUrl: "/frames/neon-pink.png",
    priceStars: 3,
    rarity: "COMMON",
  },

  // ═══ RARE (10-25 Stars) ═══
  {
    slug: "frame-crime-tape",
    title: "Полицейская лента",
    description: "Осторожно! Место преступления",
    imageUrl: "/frames/crime-tape.png",
    priceStars: 10,
    rarity: "RARE",
  },
  {
    slug: "frame-blood-splatter",
    title: "Кровавые брызги",
    description: "Для настоящих детективов",
    imageUrl: "/frames/blood-splatter.png",
    priceStars: 15,
    rarity: "RARE",
  },
  {
    slug: "frame-detective-badge",
    title: "Значок детектива",
    description: "Официальный значок следователя",
    imageUrl: "/frames/detective-badge.png",
    priceStars: 20,
    rarity: "RARE",
  },
  {
    slug: "frame-magnifying-glass",
    title: "Лупа",
    description: "Инструмент истинного сыщика",
    imageUrl: "/frames/magnifying-glass.png",
    priceStars: 25,
    rarity: "RARE",
  },

  // ═══ EPIC (50-100 Stars) ═══
  {
    slug: "frame-serial-hunter",
    title: "Охотник за серийниками",
    description: "Для тех, кто ловит маньяков",
    imageUrl: "/frames/serial-hunter.png",
    priceStars: 50,
    rarity: "EPIC",
  },
  {
    slug: "frame-fbi-profiler",
    title: "Профайлер ФБР",
    description: "Mindhunter edition",
    imageUrl: "/frames/fbi-profiler.png",
    priceStars: 75,
    rarity: "EPIC",
  },
  {
    slug: "frame-dark-mystery",
    title: "Тёмная тайна",
    description: "Окутано мраком и загадками",
    imageUrl: "/frames/dark-mystery.png",
    priceStars: 100,
    rarity: "EPIC",
  },

  // ═══ LEGENDARY (200-500 Stars) ═══
  {
    slug: "frame-true-crime-master",
    title: "Мастер True Crime",
    description: "Легендарный знаток криминала",
    imageUrl: "/frames/true-crime-master.png",
    priceStars: 200,
    rarity: "LEGENDARY",
  },
  {
    slug: "frame-zodiac-killer",
    title: "Шифр Зодиака",
    description: "Неразгаданная тайна",
    imageUrl: "/frames/zodiac-cipher.png",
    priceStars: 350,
    rarity: "LEGENDARY",
  },
  {
    slug: "frame-champion-skull",
    title: "Череп Чемпиона",
    description: "Для абсолютных победителей",
    imageUrl: "/frames/champion-skull.png",
    priceStars: 500,
    rarity: "LEGENDARY",
  },
];

async function main() {
  console.log("🎨 Seeding cosmetic frames...\n");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const frame of FRAMES) {
    try {
      const existing = await prisma.cosmeticItem.findUnique({
        where: { slug: frame.slug },
      });

      if (existing) {
        // Update existing
        await prisma.cosmeticItem.update({
          where: { slug: frame.slug },
          data: {
            title: frame.title,
            description: frame.description,
            imageUrl: frame.imageUrl,
            priceStars: frame.priceStars,
            rarity: frame.rarity,
            type: "FRAME",
            isActive: true,
          },
        });
        updated++;
        console.log(`  ✏️  Updated: ${frame.title} (${frame.rarity})`);
      } else {
        // Create new
        await prisma.cosmeticItem.create({
          data: {
            slug: frame.slug,
            title: frame.title,
            description: frame.description,
            imageUrl: frame.imageUrl,
            priceStars: frame.priceStars,
            rarity: frame.rarity,
            type: "FRAME",
            isActive: true,
          },
        });
        created++;
        console.log(`  ✅ Created: ${frame.title} (${frame.rarity}) - ⭐${frame.priceStars}`);
      }
    } catch (error) {
      skipped++;
      console.error(`  ❌ Failed: ${frame.slug}`, error);
    }
  }

  console.log("\n═══════════════════════════════════════");
  console.log(`📊 Results:`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total:   ${FRAMES.length}`);
  console.log("═══════════════════════════════════════\n");

  // Show current items in DB
  const allItems = await prisma.cosmeticItem.findMany({
    orderBy: [{ rarity: "desc" }, { priceStars: "asc" }],
  });

  console.log("🛒 Current shop items:");
  for (const item of allItems) {
    const rarityEmoji = {
      LEGENDARY: "🌟",
      EPIC: "💜",
      RARE: "💙",
      COMMON: "⚪",
    }[item.rarity];
    console.log(`   ${rarityEmoji} ${item.title} - ⭐${item.priceStars} (${item.slug})`);
  }
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
