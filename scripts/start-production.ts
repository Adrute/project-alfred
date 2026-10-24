import { spawn } from "node:child_process";
import path from "node:path";
import { once } from "node:events";
import { loadConfig } from "../src/config/env";
import { clearOrphanedChatGptLocks } from "../src/services/chatgpt-auth-service";

const config = loadConfig();

// Production is intentionally single-instance. Clear locks left by a previous
// abruptly terminated container before any web process can use the credential store.
await clearOrphanedChatGptLocks();

async function run(command: string, arguments_: string[]): Promise<number> {
  const child = spawn(command, arguments_, { cwd: process.cwd(), env: process.env, stdio: "inherit" });
  const [code] = await once(child, "exit") as [number | null, NodeJS.Signals | null];
  return code ?? 1;
}

const migrationStatus = await run(process.execPath, [
  "--import",
  "tsx",
  path.resolve("scripts", "deploy-database.ts"),
]);

if (migrationStatus !== 0) {
  console.error("Las migraciones no se completaron; Alfred no se iniciará.");
  process.exit(migrationStatus);
}

const server = spawn(process.execPath, [
  path.resolve("node_modules", "next", "dist", "bin", "next"),
  "start",
  "--hostname",
  config.HOST,
  "--port",
  String(config.PORT),
], { cwd: process.cwd(), env: process.env, stdio: "inherit" });

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => server.kill(signal));
}

const [serverStatus] = await once(server, "exit") as [number | null, NodeJS.Signals | null];
process.exitCode = serverStatus ?? 1;
