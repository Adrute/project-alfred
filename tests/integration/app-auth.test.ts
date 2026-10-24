import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

vi.mock("@/lib/database", async () => {
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const directory = mkdtempSync(path.join(tmpdir(), "alfred-auth-test-"));
  const database = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${path.join(directory, "test.db")}` }) });
  return { database, testDirectory: directory };
});
import { database } from "@/lib/database";
import { authRepository } from "@/repositories/auth-repository";
import { authenticate, checkLoginRate, csrfToken, hashPassword, hashSessionToken, login, logout, manageAppUser, sessionCookie, verifyPassword } from "@/services/auth-service";
import { withApiAuth, requireAdminContext } from "@/lib/api-security";
import { GET, POST, DELETE } from "@/app/api/auth/session/route";
import { GET as health } from "@/app/api/health/route";
import { proposeAction } from "@/services/action-service";
import { POST as confirmPendingAction } from "@/app/api/actions/[id]/confirm/route";

const origin = "http://127.0.0.1:3000";
const password = "Contraseña-ficticia-123";
function request(method: string, token?: string, body?: string, extra: Record<string, string> = {}) {
  return new Request(`${origin}/api/test`, { method, headers: { origin, ...(token ? { cookie: `alfred_session=${token}`, "x-alfred-csrf": csrfToken(token) } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}), ...extra }, ...(body !== undefined ? { body } : {}) });
}
beforeAll(async () => {
  const connection = await import("@/lib/database") as unknown as { testDirectory: string };
  const { default: Sqlite } = await import("better-sqlite3");
  const sqlite = new Sqlite(path.join(connection.testDirectory, "test.db"));
  for (const directory of readdirSync("prisma/migrations").sort()) {
    if (!directory.endsWith(".toml")) sqlite.exec(readFileSync(path.join("prisma/migrations", directory, "migration.sql"), "utf8"));
  }
  sqlite.close();
  await manageAppUser("create", "admin-fixture", "Administradora ficticia", "admin", password);
  await manageAppUser("create", "user-fixture", "Usuaria ficticia", "user", password);
});
afterAll(async () => {
  await database.$disconnect();
  const connection = await import("@/lib/database") as unknown as { testDirectory: string };
  rmSync(connection.testDirectory, { recursive: true, force: true });
});

describe("application authentication boundary", () => {
  it("hashes passwords with random salts and verifies them", async () => {
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    expect(hash).not.toBe(await hashPassword(password));
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("incorrect-password", hash)).toBe(false);
    expect(await verifyPassword(password, "invalid")).toBe(false);
    await expect(hashPassword("short")).rejects.toThrow();
  });
  it("returns 401 without a session and never stores its raw token", async () => {
    expect((await GET(request("GET"), undefined)).status).toBe(401);
    const { token } = await login("admin-fixture", password);
    const session = await database.appSession.findUniqueOrThrow({ where: { tokenHash: hashSessionToken(token) } });
    expect(session.tokenHash).not.toBe(token);
    expect(token.length).toBe(43);
    expect((await authenticate(request("GET", token))).user.role).toBe("admin");
    expect(sessionCookie(token)).toContain("HttpOnly; SameSite=Lax; Max-Age=43200");
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_ORIGIN", "https://example.ts.net");
    expect(sessionCookie(token)).toContain("; Secure"); vi.unstubAllEnvs();
  });
  it("requires administrator role at the route and inside control-action execution", async () => {
    const { token } = await login("user-fixture", password);
    const admin = withApiAuth(async () => Response.json({ ok: true }), "admin");
    expect((await admin(request("GET", token), undefined)).status).toBe(403);
    const indirect = withApiAuth(async () => { requireAdminContext(); return Response.json({ ok: true }); });
    expect((await indirect(request("POST", token), undefined)).status).toBe(403);
    await database.appUser.update({ where: { username: "user-fixture" }, data: { role: "admin" } });
    expect((await admin(request("GET", token), undefined)).status).toBe(200);
    await database.appUser.update({ where: { username: "user-fixture" }, data: { role: "user" } });
  });
  it("preserves origin, CSRF, type, JSON and streaming size error statuses", async () => {
    const { token } = await login("admin-fixture", password);
    const handler = withApiAuth(async (req: Request) => Response.json(await req.json()));
    const forbidden: Record<string, string>[] = [{ origin: "https://evil.example" }, { "sec-fetch-site": "cross-site" }, { "x-alfred-csrf": "wrong" }, { origin: "" }];
    for (const headers of forbidden) {
      expect((await handler(request("POST", token, "{}", headers), undefined)).status).toBe(403);
    }
    expect((await handler(request("POST", token, "{}", { "content-type": "text/plain" }), undefined)).status).toBe(415);
    expect((await handler(request("POST", token, "{}", { "content-type": "application/a2a+json" }), undefined)).status).toBe(200);
    expect((await handler(request("POST", token, "{"), undefined)).status).toBe(400);
    expect((await handler(request("POST", token, JSON.stringify({ message: "x".repeat(256 * 1024) })), undefined)).status).toBe(413);
    expect((await handler(request("POST", token, "{}"), undefined)).status).toBe(200);
  });
  it("prevents a regular user confirming an administrative proposal from chat", async () => {
    const { token } = await login("user-fixture", password);
    const proposal = await proposeAction({ type: "control_agent", agentId: "curriculum-agent", action: "stop" });
    const response = await confirmPendingAction(request("POST", token), { params: Promise.resolve({ id: proposal.id }) });
    expect(response.status).toBe(403);
    expect(await database.pendingAction.findUniqueOrThrow({ where: { id: proposal.id } })).toMatchObject({ status: "pending" });
  });
  it("authenticates through HTTP and revokes logout sessions", async () => {
    expect((await POST(request("POST", undefined, JSON.stringify({ username: "admin-fixture", password })))).status).toBe(200);
    expect((await POST(request("POST", undefined, JSON.stringify({ username: "admin-fixture", password }), { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(request("POST", undefined, JSON.stringify({ username: "admin-fixture", password: "x".repeat(9000) })))).status).toBe(413);
    const { token } = await login("admin-fixture", password);
    const response = await GET(request("GET", token), undefined);
    expect(await response.json()).toMatchObject({ user: { role: "admin" }, csrfToken: csrfToken(token) });
    expect((await DELETE(request("DELETE", token), undefined)).status).toBe(200);
    await expect(authenticate(request("GET", token))).rejects.toMatchObject({ status: 401 });
  });
  it("accepts an empty streamed mutation body without requiring JSON", async () => {
    const { token } = await login("admin-fixture", password);
    const emptyBody = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
    const streamed = new Request(`${origin}/api/test`, {
      method: "DELETE",
      headers: { origin, cookie: `alfred_session=${token}`, "x-alfred-csrf": csrfToken(token) },
      body: emptyBody,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const handler = withApiAuth(async () => Response.json({ ok: true }));
    expect((await handler(streamed, undefined)).status).toBe(200);
  });
  it("revokes sessions on password change, disables users and rejects expired tokens", async () => {
    const { token } = await login("user-fixture", password);
    await manageAppUser("update", "user-fixture", undefined, undefined, "New-fixture-password-456");
    await expect(authenticate(request("GET", token))).rejects.toMatchObject({ status: 401 });
    const next = await login("user-fixture", "New-fixture-password-456");
    await database.appSession.updateMany({ where: { tokenHash: hashSessionToken(next.token) }, data: { expiresAt: new Date(0) } });
    await expect(authenticate(request("GET", next.token))).rejects.toMatchObject({ status: 401 });
    await manageAppUser("disable", "user-fixture");
    await expect(login("user-fixture", "New-fixture-password-456")).rejects.toMatchObject({ status: 401 });
    await logout(next.token);
  });
  it("cannot create a session from credentials replaced during password verification", async () => {
    await manageAppUser("create", "race-fixture", "Cuenta de carrera ficticia", "user", password);
    const stale = await authRepository.findUser("race-fixture");
    expect(stale).not.toBeNull();
    await manageAppUser("update", "race-fixture", undefined, undefined, "New-race-password-456");
    const created = await authRepository.createSessionForCredentials(
      stale!.id,
      stale!.passwordHash,
      hashSessionToken("stale-session-token"),
      new Date(Date.now() + 60_000),
    );
    expect(created).toBe(false);
    expect(await database.appSession.findUnique({ where: { tokenHash: hashSessionToken("stale-session-token") } })).toBeNull();
  });
  it("limits brute force without using proxy IP headers", () => {
    for (let i = 0; i < 5; i++) checkLoginRate("rate-fixture");
    expect(() => checkLoginRate("rate-fixture")).toThrow(/Demasiados/);
    expect(() => checkLoginRate("rate-fixture", Date.now() + 16 * 60_000)).not.toThrow();
  });
  it("returns an anonymous minimal health payload", async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
