import "dotenv/config";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/alfred.db";
if (!databaseUrl.startsWith("file:") || databaseUrl.slice("file:".length).trim().length === 0) {
  console.error("DATABASE_URL debe apuntar a un archivo SQLite con el prefijo file:.");
  process.exit(1);
}

const configuredPath = databaseUrl.slice("file:".length);
const databasePath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
mkdirSync(path.dirname(databasePath), { recursive: true });
new Database(databasePath).close();

// Resolve the installed CLI directly: never let npx download a migration tool.
const require = createRequire(import.meta.url);
const prismaExecutable = path.join(path.dirname(require.resolve("prisma/package.json")), "build", "index.js");
const result = spawnSync(process.execPath, [prismaExecutable, "migrate", "deploy"], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: `file:${databasePath}` },
  stdio: "inherit",
});

if (result.error) {
  console.error("No se pudo iniciar Prisma.");
  process.exit(1);
}
process.exit(result.status ?? 1);
