import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const price = parseInt(process.argv[2] || "1", 10);
  
  console.log(`💫 Устанавливаем цену ${price} Star на все рамки...\n`);
  
  const result = await prisma.cosmeticItem.updateMany({
    where: { type: "FRAME" },
    data: { priceStars: price },
  });
  
  console.log(`✅ Обновлено рамок: ${result.count}\n`);
  
  const items = await prisma.cosmeticItem.findMany({
    where: { type: "FRAME", isActive: true },
    select: { slug: true, title: true, priceStars: true },
    orderBy: { title: "asc" },
  });
  
  console.log("📦 Текущие цены:");
  items.forEach((i) => console.log(`   ${i.title} — ${i.priceStars} ⭐`));
}

main()
  .finally(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Ошибка:", e);
    process.exit(1);
  });
