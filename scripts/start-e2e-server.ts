import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const testDirectory = mkdtempSync(path.join(tmpdir(), "alfred-e2e-"));
const databasePath = path.join(testDirectory, "alfred.db");
const runtimeDirectory = path.join(testDirectory, "runtime");
const testEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: `file:${databasePath}`,
  NODE_ENV: "development",
  PORT: "3100",
  DATA_DIRECTORY: runtimeDirectory,
  ALFRED_E2E: "1",
  APP_ORIGIN: "http://127.0.0.1:3100",
  CLOUD_AI_ENABLED: "false",
};

const cleanup = () => rmSync(testDirectory, { force: true, recursive: true });

for (const script of ["scripts/deploy-database.ts", "prisma/seed.ts"]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script], {
    cwd: process.cwd(),
    env: testEnvironment,
    stdio: "inherit",
  });
  if (result.status !== 0) { cleanup(); process.exit(result.status ?? 1); }
}

for (const [username, role] of [["e2e-admin", "admin"], ["e2e-user", "user"]]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/manage-users.ts", "create", username, role, "Docente ficticio"], {
    cwd: process.cwd(), env: testEnvironment, input: "Alfred-ficticio-e2e-2026\n", stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.status !== 0) { cleanup(); process.exit(result.status ?? 1); }
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

server.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
