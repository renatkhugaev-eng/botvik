import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("\n🔍 Checking Panorama Missions in DB...\n");
  
  const missions = await prisma.panoramaMission.findMany({
    select: { 
      id: true, 
      title: true, 
      location: true,
      isPublished: true, 
      isFeatured: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  
  console.log(`📊 Total missions in DB: ${missions.length}\n`);
  
  if (missions.length === 0) {
    console.log("❌ No missions found in database!");
  } else {
    missions.forEach(m => {
      const status = m.isPublished ? "✅ Published" : "❌ Draft";
      const featured = m.isFeatured ? "⭐" : "";
      console.log(`  ${status} ${featured} ${m.title} (${m.location})`);
      console.log(`     ID: ${m.id}`);
    });
  }
  
  const publishedCount = missions.filter(m => m.isPublished).length;
  console.log(`\n📈 Published: ${publishedCount}/${missions.length}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);

