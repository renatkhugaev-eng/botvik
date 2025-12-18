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
    slug: "frame-mouse",
    title: "Мышка",
    description: "Милая рамка с мышонком",
    imageUrl: "/frames/mouse.png",
    priceStars: 1,
    rarity: "COMMON",
  },
  {
    slug: "frame-sheep",
    title: "Овечка",
    description: "Пушистая рамка с овечкой",
    imageUrl: "/frames/sheep.png",
    priceStars: 2,
    rarity: "COMMON",
  },

  // ═══ RARE (10-25 Stars) ═══
  {
    slug: "frame-zebra",
    title: "Зебра",
    description: "Стильная полосатая рамка",
    imageUrl: "/frames/zebra.png",
    priceStars: 10,
    rarity: "RARE",
  },

  // ═══ EPIC (50-100 Stars) ═══
  {
    slug: "frame-horse",
    title: "Лошадка",
    description: "Грациозная рамка с лошадью",
    imageUrl: "/frames/horse.png",
    priceStars: 50,
    rarity: "EPIC",
  },

  // ═══ LEGENDARY (200-500 Stars) ═══
  {
    slug: "frame-giraffe",
    title: "Жираф",
    description: "Экзотическая рамка с жирафом",
    imageUrl: "/frames/giraffe.png",
    priceStars: 100,
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
