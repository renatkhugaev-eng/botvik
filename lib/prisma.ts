import { PrismaNeon } from "@prisma/adapter-neon";

// Берём PrismaClient через require, чтобы TypeScript и Vercel не ругались на named import
// и ошибку "no exported member PrismaClient".
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
type PrismaClientType = import("@prisma/client").PrismaClient;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaNeon({ connectionString });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientType;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

