import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";
import { loadConfig } from "@/config/env";

function absoluteDatabaseUrl(databaseUrl: string): string {
  const filePath = databaseUrl.slice("file:".length);
  if (path.isAbsolute(filePath)) {
    return databaseUrl;
  }
  return `file:${path.resolve(/* turbopackIgnore: true */ process.cwd(), filePath)}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createDatabaseClient(): PrismaClient {
  const config = loadConfig();
  const adapter = new PrismaBetterSqlite3({
    url: absoluteDatabaseUrl(config.DATABASE_URL),
  });
  return new PrismaClient({ adapter });
}

export const database = globalForPrisma.prisma ?? createDatabaseClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = database;
}
