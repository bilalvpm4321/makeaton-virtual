import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

// App traffic uses Neon's pooled connection (DATABASE_URL, "-pooler" host) through node-postgres.
// Migrations use the direct connection (DATABASE_URL_UNPOOLED) via `directUrl` in schema.prisma.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pgPool?: Pool };

function createPool(): Pool {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  // On Vercel Fluid compute, releases idle connections before the function instance is suspended.
  attachDatabasePool(pool);
  return pool;
}

const pool = globalForPrisma.pgPool ?? createPool();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
