import "dotenv/config";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/alfred.db";
if (!databaseUrl.startsWith("file:")) {
  console.error("DATABASE_URL debe apuntar a un archivo SQLite con el prefijo file:.");
  process.exit(1);
}

const configuredPath = databaseUrl.slice("file:".length);
const databasePath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
mkdirSync(path.dirname(databasePath), { recursive: true });
new Database(databasePath).close();

const prismaExecutable = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(prismaExecutable, ["prisma", "migrate", "deploy"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error("No se pudo iniciar Prisma.", result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
