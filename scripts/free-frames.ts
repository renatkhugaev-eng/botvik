/**
 * Make all frames free for testing
 * Run: npx tsx scripts/free-frames.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.cosmeticItem.updateMany({
    data: { priceStars: 0 },
  });
  console.log(`✅ Made ${result.count} items FREE (0 Stars)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
