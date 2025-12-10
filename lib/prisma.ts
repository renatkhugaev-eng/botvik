import { PrismaNeon } from "@prisma/adapter-neon";

// Берём PrismaClient через require без явной типизации,
// чтобы TypeScript на Vercel не проверял структуру модуля и не ругался.
const { PrismaClient } = require("@prisma/client");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaNeon({ connectionString });

const globalForPrisma = globalThis as any;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

