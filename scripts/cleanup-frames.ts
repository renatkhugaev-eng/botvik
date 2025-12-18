/**
 * Cleanup script - removes frames without actual images
 * Run: npx tsx scripts/cleanup-frames.ts
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

// Только эти рамки имеют реальные картинки
const VALID_SLUGS = [
  "frame-mouse",
  "frame-sheep", 
  "frame-zebra",
  "frame-horse",
  "frame-giraffe",
];

async function main() {
  console.log("🧹 Deactivating frames without images...\n");

  // Деактивируем все рамки кроме валидных (не удаляем из-за foreign keys)
  const deactivated = await prisma.cosmeticItem.updateMany({
    where: { 
      slug: { notIn: VALID_SLUGS } 
    },
    data: {
      isActive: false,
    },
  });

  console.log(`✅ Deactivated ${deactivated.count} items without images\n`);

  // Показываем что осталось АКТИВНЫХ
  const remaining = await prisma.cosmeticItem.findMany({
    where: { isActive: true },
    orderBy: { priceStars: "asc" },
  });

  console.log("🛒 Active shop items:");
  for (const item of remaining) {
    console.log(`   - ${item.title} (${item.slug}) → ${item.imageUrl}`);
  }
}

main()
  .catch((e) => {
    console.error("Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
