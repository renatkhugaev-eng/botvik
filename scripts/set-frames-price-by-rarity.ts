import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

// Цены по редкости (в Stars)
const PRICES_BY_RARITY = {
  COMMON: 200,      // ⚪ Обычные
  RARE: 350,        // 💙 Редкие
  EPIC: 500,        // 💜 Эпические
  LEGENDARY: 750,   // 🌟 Легендарные
};

async function main() {
  console.log("💫 Устанавливаем цены по редкости...\n");

  for (const [rarity, price] of Object.entries(PRICES_BY_RARITY)) {
    const result = await prisma.cosmeticItem.updateMany({
      where: { 
        type: "FRAME",
        rarity: rarity as keyof typeof PRICES_BY_RARITY,
      },
      data: { priceStars: price },
    });
    
    const icon = rarity === "COMMON" ? "⚪" 
               : rarity === "RARE" ? "💙" 
               : rarity === "EPIC" ? "💜" 
               : "🌟";
    
    console.log(`  ${icon} ${rarity}: ${price} ⭐ (${result.count} шт.)`);
  }

  console.log("\n✅ Готово!\n");

  // Показываем итог
  const items = await prisma.cosmeticItem.findMany({
    where: { type: "FRAME", isActive: true },
    select: { title: true, rarity: true, priceStars: true },
    orderBy: [{ rarity: "desc" }, { title: "asc" }],
  });

  console.log("📦 Все рамки:");
  items.forEach((i) => {
    const icon = i.rarity === "COMMON" ? "⚪" 
               : i.rarity === "RARE" ? "💙" 
               : i.rarity === "EPIC" ? "💜" 
               : "🌟";
    console.log(`   ${icon} ${i.title} — ${i.priceStars} ⭐`);
  });
}

main()
  .finally(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Ошибка:", e);
    process.exit(1);
  });
