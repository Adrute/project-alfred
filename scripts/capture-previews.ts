import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chromium, type Page } from "playwright";

const root = process.cwd();
const previewDirectory = path.resolve(root, "preview");
const databasePath = path.resolve(root, "data", "alfred-preview.db");
const runtimeDirectory = path.resolve(root, "data", "preview-runtime");
const port = "3200";
const baseUrl = `http://127.0.0.1:${port}`;
const previewEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: "file:./data/alfred-preview.db",
  DATA_DIRECTORY: runtimeDirectory,
  NODE_ENV: "production",
  PORT: port,
};

function runScript(script: string) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script], {
    cwd: root,
    env: previewEnvironment,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`No se pudo ejecutar ${script}.`);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // El servidor todavía está arrancando.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("El servidor de capturas no respondió a tiempo.");
}

async function stopServer(server: ChildProcess) {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => server.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

async function capture(page: Page, filename: string) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(previewDirectory, filename), animations: "disabled" });
  console.info(`Capturada preview/${filename}`);
}

rmSync(databasePath, { force: true });
rmSync(`${databasePath}-shm`, { force: true });
rmSync(`${databasePath}-wal`, { force: true });
rmSync(runtimeDirectory, { recursive: true, force: true });
mkdirSync(previewDirectory, { recursive: true });

for (const script of ["scripts/deploy-database.ts", "prisma/seed.ts", "scripts/prepare-demo.ts", "scripts/prepare-preview.ts"]) {
  runScript(script);
}

const nextCli = path.resolve(root, "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextCli, "start", "--hostname", "127.0.0.1", "--port", port], {
  cwd: root,
  env: previewEnvironment,
  stdio: "inherit",
});

let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "* { scroll-behavior: auto !important; overflow-anchor: none !important; }" });

  await capture(page, "01-inicio.png");

  await page.getByRole("button", { name: "Abrir Alfred" }).click();
  await page.getByRole("region", { name: "Alfred, asistente contextual" }).waitFor();
  await capture(page, "02-alfred-contextual.png");
  await page.getByRole("button", { name: "Cerrar Alfred" }).click();

  await page.getByRole("button", { name: /Chat con Alfred/ }).click();
  await capture(page, "03-chat.png");

  await page.getByRole("button", { name: /Planificación/ }).click();
  await page.locator(".lesson-card").first().waitFor();
  await capture(page, "04-planificacion.png");

  await page.getByRole("button", { name: /Mis asignaturas/ }).click();
  await page.locator(".assignment-strip > button", { hasText: "Inglés" }).filter({ hasText: "2.º ESO C" }).click();
  await page.getByRole("heading", { name: "Lucas Serrano" }).waitFor();
  await capture(page, "05-asignatura.png");

  await page.getByRole("button", { name: /Grupos/ }).click();
  await page.locator(".class-card", { hasText: "2.º ESO C" }).click();
  await capture(page, "06-grupo.png");

  await page.getByRole("button", { name: /Alumnos/ }).click();
  await page.locator(".list-panel > button", { hasText: "Lucas Serrano" }).click();
  await capture(page, "07-alumno.png");

  await page.locator(".tutor-context-card").click();
  await page.getByRole("heading", { name: "Lucas Serrano" }).waitFor();
  await capture(page, "08-tutoria.png");

  await page.getByRole("button", { name: /Organización del aula/ }).click();
  await page.locator(".seat-grid").waitFor();
  await capture(page, "09-organizacion-aula.png");

  await page.getByRole("button", { name: /Administración/ }).click();
  await page.locator(".agent-list").waitFor();
  await capture(page, "10-administracion-agentes.png");

  await page.getByRole("tab", { name: "Conversaciones A2A" }).click();
  await page.locator(".a2a-admin").waitFor();
  await capture(page, "11-administracion-a2a.png");

  await page.getByRole("tab", { name: "Logs" }).click();
  await page.locator(".logs-admin").waitFor();
  await capture(page, "12-administracion-logs.png");

  await page.getByRole("tab", { name: "Base de datos" }).click();
  await page.locator(".database-admin").waitFor();
  await capture(page, "13-administracion-base-datos.png");
} finally {
  await browser?.close();
  await stopServer(server);
  rmSync(databasePath, { force: true });
  rmSync(`${databasePath}-shm`, { force: true });
  rmSync(`${databasePath}-wal`, { force: true });
  rmSync(runtimeDirectory, { recursive: true, force: true });
}
