import { rmSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const databasePath = path.resolve(process.cwd(), "data", "alfred-e2e.db");
const runtimeDirectory = path.resolve(process.cwd(), "data", "e2e-runtime");
const testEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: `file:${databasePath}`,
  NODE_ENV: "development",
  PORT: "3100",
  DATA_DIRECTORY: runtimeDirectory,
  ALFRED_E2E: "1",
};

// This file is exclusively owned by the end-to-end suite. Starting a run from
// a clean database makes the test repeatable and keeps demo/user data intact.
rmSync(databasePath, { force: true });
rmSync(runtimeDirectory, { force: true, recursive: true });

for (const script of ["scripts/deploy-database.ts", "prisma/seed.ts"]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script], {
    cwd: process.cwd(),
    env: testEnvironment,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const nextCli = path.resolve(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextCli, "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  cwd: process.cwd(),
  env: testEnvironment,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code) => process.exit(code ?? 0));
