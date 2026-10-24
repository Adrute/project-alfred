import { test, expect } from "@playwright/test";

test("private mobile workspace, roles, PWA metadata and logout", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Usuario", { exact: true }).fill("e2e-user");
  await page.getByLabel("Contraseña", { exact: true }).fill("Alfred-ficticio-e2e-2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tu día" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Administración", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continuar con ChatGPT" })).toHaveCount(0);
  expect((await page.request.get("/api/admin/agents")).status()).toBe(403);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mobile-home.png", fullPage: true });
  await page.getByRole("button", { name: "Grupos", exact: true }).click();
  await expect(page.locator(".class-card").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/bootstrap")).status()).toBe(401);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});
