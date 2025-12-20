/**
 * Миграция imageUrl в CosmeticItem с .png на .webp
 * Запуск: npx ts-node scripts/migrate-frames-to-webp.ts
 */

import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("\n🖼️  Миграция frames с .png на .webp\n");

  // Получаем все CosmeticItem с .png в imageUrl
  const items = await prisma.cosmeticItem.findMany({
    where: {
      imageUrl: { endsWith: ".png" },
    },
  });

  console.log(`Найдено ${items.length} элементов с .png:\n`);

  for (const item of items) {
    const newImageUrl = item.imageUrl.replace(/\.png$/, ".webp");
    const newPreviewUrl = item.previewUrl?.replace(/\.png$/, ".webp") ?? null;

    console.log(`  [${item.id}] ${item.title}`);
    console.log(`     imageUrl: ${item.imageUrl} → ${newImageUrl}`);
    if (item.previewUrl) {
      console.log(`     previewUrl: ${item.previewUrl} → ${newPreviewUrl}`);
    }

    await prisma.cosmeticItem.update({
      where: { id: item.id },
      data: {
        imageUrl: newImageUrl,
        previewUrl: newPreviewUrl,
      },
    });

    console.log(`     ✅ Обновлено!\n`);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`✅ Миграция завершена! Обновлено ${items.length} элементов.`);
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
