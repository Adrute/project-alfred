import { generateKeyPairSync, sign } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { beginChatGptSignIn, completeChatGptSignIn, getAliasSecret, getChatGptSession, getChatGptStatus, importChatGptCredentials, retireLocalChatGptCredentials } from "@/services/chatgpt-auth-service";

const adminSession = "a".repeat(43);

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function configure(origin: string, clientId?: string) {
  vi.stubEnv("CLOUD_AI_ENABLED", "true");
  const directory = await mkdtemp(path.join(os.tmpdir(), "alfred-oauth-test-"));
  vi.stubEnv("DATA_DIRECTORY", directory);
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("PORT", origin.endsWith(":3456") ? "3456" : "3000");
  if (clientId) vi.stubEnv("CHATGPT_OAUTH_CLIENT_ID", clientId);
  return directory;
}

describe("ChatGPT OAuth sign-in", () => {
  it("creates one stable host and alias secret under concurrent first reads", async () => {
    const directory = await configure("http://127.0.0.1:3456");
    const secrets = await Promise.all(Array.from({ length: 12 }, () => getAliasSecret()));
    const persisted = JSON.parse(await readFile(path.join(directory, "auth", "chatgpt.json"), "utf8"));
    expect(new Set(secrets).size).toBe(1);
    expect(secrets[0]).toBe(persisted.aliasSecret);
  });

  it("uses the loopback callback for local open-source sign-in", async () => {
    await configure("http://127.0.0.1:3456", "oaiapp_web_not_registered_for_loopback");
    const authorization = new URL(await beginChatGptSignIn(adminSession));
    expect(authorization.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3456/auth/callback");
    expect(authorization.searchParams.get("client_id")).toBe("dynamic_agent_client");
  });

  it.each([
    [undefined, "/auth/callback"],
    ["/auth/callback", "/auth/callback"],
    ["/api/auth/chatgpt/callback", "/api/auth/chatgpt/callback"],
  ])("preserves the callback for a saved local client (%s)", async (callbackPath, expectedPath) => {
    const directory = await configure("http://127.0.0.1:3456");
    const authDirectory = path.join(directory, "auth");
    await mkdir(authDirectory);
    await writeFile(path.join(authDirectory, "chatgpt.json"), JSON.stringify({
      version: 1,
      hostId: "urn:uuid:11111111-1111-4111-8111-111111111111",
      aliasSecret: "fictional-alias-secret-with-at-least-32-characters",
      registration: { subject: "fictional-user", clientId: "oaiapp_old", email: "fictional@example.test", scopes: [], callbackPath },
      pending: null,
    }));

    const authorization = new URL(await beginChatGptSignIn(adminSession));
    expect(authorization.searchParams.get("client_id")).toBe("oaiapp_old");
    expect(authorization.searchParams.get("redirect_uri")).toBe(`http://127.0.0.1:3456${expectedPath}`);
    expect(authorization.searchParams.has("agent_name_hint")).toBe(false);
    expect(authorization.searchParams.get("ext_agent_host_id")).toBe("urn:uuid:11111111-1111-4111-8111-111111111111");
    expect(authorization.searchParams.get("login_hint")).toBe("fictional@example.test");
  });

  it("allows an explicit local callback path for a legacy client", async () => {
    const directory = await configure("http://127.0.0.1:3456");
    const authDirectory = path.join(directory, "auth");
    await mkdir(authDirectory);
    await writeFile(path.join(authDirectory, "chatgpt.json"), JSON.stringify({
      version: 1,
      hostId: "urn:uuid:11111111-1111-4111-8111-111111111111",
      aliasSecret: "fictional-alias-secret-with-at-least-32-characters",
      registration: { subject: "fictional-user", clientId: "oaiapp_old", scopes: [] },
      pending: null,
    }));
    vi.stubEnv("CHATGPT_LOCAL_CALLBACK_PATH", "/api/auth/chatgpt/callback");
    const authorization = new URL(await beginChatGptSignIn(adminSession));
    expect(authorization.searchParams.get("client_id")).toBe("oaiapp_old");
    expect(authorization.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3456/api/auth/chatgpt/callback");
  });

  it("uses the current callback for a new registration even with a legacy override", async () => {
    await configure("http://127.0.0.1:3456");
    vi.stubEnv("CHATGPT_LOCAL_CALLBACK_PATH", "/api/auth/chatgpt/callback");
    const authorization = new URL(await beginChatGptSignIn(adminSession));
    expect(authorization.searchParams.get("client_id")).toBe("dynamic_agent_client");
    expect(authorization.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3456/auth/callback");
  });

  it("starts a fresh local registration with the official callback without replacing the saved session", async () => {
    const directory = await configure("http://127.0.0.1:3456");
    const authDirectory = path.join(directory, "auth");
    await mkdir(authDirectory);
    const file = path.join(authDirectory, "chatgpt.json");
    await writeFile(file, JSON.stringify({
      version: 1, hostId: "urn:uuid:11111111-1111-4111-8111-111111111111",
      aliasSecret: "fictional-alias-secret-with-at-least-32-characters",
      registration: { subject: "fictional-user", clientId: "oaiapp_old", callbackPath: "/api/auth/chatgpt/callback", scopes: [] },
      pending: null,
    }));
    vi.stubEnv("CHATGPT_LOCAL_CALLBACK_PATH", "/api/auth/chatgpt/callback");
    const authorization = new URL(await beginChatGptSignIn(adminSession, true));
    expect(authorization.searchParams.get("client_id")).toBe("dynamic_agent_client");
    expect(authorization.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3456/auth/callback");
    expect(authorization.searchParams.get("agent_name_hint")).toBe("Alfred");
    expect(JSON.parse(await readFile(file, "utf8")).registration.clientId).toBe("oaiapp_old");
  });

  it("imports a protected local registration while preserving the VM host and alias secret", async () => {
    const directory = await configure("https://alfred.example.ts.net");
    const source = path.join(directory, "mac-chatgpt.json");
    await writeFile(source, JSON.stringify({
      version: 1, hostId: "urn:uuid:11111111-1111-4111-8111-111111111111",
      aliasSecret: "fictional-mac-alias-secret-with-at-least-32-characters",
      registration: {
        subject: "fictional-user", clientId: "oaiapp_local", accessToken: "fictional-access",
        refreshToken: "fictional-refresh", expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        scopes: ["chatgpt.tokens.use.direct"], callbackPath: "/auth/callback",
      }, pending: null,
    }), { mode: 0o600 });
    const before = await getChatGptStatus();
    expect(before.planEnabled).toBe(false);
    const destinationFile = path.join(directory, "auth", "chatgpt.json");
    const destinationBefore = JSON.parse(await readFile(destinationFile, "utf8"));
    await importChatGptCredentials(source);
    const imported = JSON.parse(await readFile(destinationFile, "utf8"));
    expect(imported.hostId).toBe(destinationBefore.hostId);
    expect(imported.aliasSecret).toBe(destinationBefore.aliasSecret);
    expect(imported.registration.clientId).toBe("oaiapp_local");
    expect((await getChatGptStatus()).planEnabled).toBe(true);
    await expect(importChatGptCredentials(source)).rejects.toThrow(/ya tiene una conexión/);
    await retireLocalChatGptCredentials();
    const retired = JSON.parse(await readFile(destinationFile, "utf8"));
    expect(retired.hostId).toBe(destinationBefore.hostId);
    expect(retired.registration.clientId).toBe("oaiapp_local");
    expect(retired.registration.accessToken).toBeUndefined();
    expect(retired.registration.refreshToken).toBeUndefined();
    expect((await getChatGptStatus()).planEnabled).toBe(false);
  });

  it("reports an expired, unrenewable session as disconnected", async () => {
    const directory = await configure("http://127.0.0.1:3456");
    const authDirectory = path.join(directory, "auth");
    await mkdir(authDirectory);
    await writeFile(path.join(authDirectory, "chatgpt.json"), JSON.stringify({
      version: 1, hostId: "urn:uuid:11111111-1111-4111-8111-111111111111",
      aliasSecret: "fictional-alias-secret-with-at-least-32-characters",
      registration: {
        subject: "fictional-user", clientId: "oaiapp_old", accessToken: "expired-access",
        refreshToken: "revoked-refresh", expiresAt: new Date(Date.now() - 60_000).toISOString(),
        scopes: ["chatgpt.tokens.use.direct"],
      }, pending: null,
    }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    expect(await getChatGptStatus()).toMatchObject({ connected: false, planEnabled: false });
  });

  it("uses a registered web client and the exact HTTPS callback on a remote instance", async () => {
    await configure("https://alfred.example.ts.net", "oaiapp_fictional");
    const authorization = new URL(await beginChatGptSignIn(adminSession));
    expect(authorization.searchParams.get("redirect_uri")).toBe("https://alfred.example.ts.net/auth/callback");
    expect(authorization.searchParams.get("client_id")).toBe("oaiapp_fictional");
    expect(authorization.searchParams.get("scope")).toContain("chatgpt.tokens.use.direct");
    expect((await getChatGptStatus()).canSignInHere).toBe(true);
  });

  it("requires a registered client on a remote instance", async () => {
    await configure("https://alfred.example.ts.net");
    await expect(beginChatGptSignIn(adminSession)).rejects.toThrow(/cliente OAuth web/);
    expect((await getChatGptStatus()).canSignInHere).toBe(false);
  });

  it("does not consume the authorization attempt for another session or state", async () => {
    await configure("https://alfred.example.ts.net", "oaiapp_fictional");
    const authorization = new URL(await beginChatGptSignIn(adminSession));
    const state = authorization.searchParams.get("state")!;
    await expect(completeChatGptSignIn(new URLSearchParams({ state, error: "access_denied" }), "b".repeat(43)))
      .rejects.toThrow(/otra sesión/);
    await expect(completeChatGptSignIn(new URLSearchParams({ state: "wrong", error: "access_denied" }), adminSession))
      .rejects.toThrow(/no coincide/);
    await expect(completeChatGptSignIn(new URLSearchParams({ state, error: "access_denied" }), adminSession))
      .rejects.toThrow(/canceló o rechazó/);
    await expect(completeChatGptSignIn(new URLSearchParams({ state, error: "access_denied" }), adminSession))
      .rejects.toThrow(/No hay ningún inicio/);
  });

  it.each([
    ["openid chatgpt.tokens.use.direct", true],
    ["openid", false],
  ])("completes the web callback once with scope %s", async (scope, planEnabled) => {
    await configure("https://alfred.example.ts.net", "oaiapp_fictional");
    const authorization = new URL(await beginChatGptSignIn(adminSession));
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "fictional-key" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: "https://auth.openai.com",
      sub: "fictional-user",
      aud: "oaiapp_fictional",
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: authorization.searchParams.get("nonce"),
    })).toString("base64url");
    const idToken = `${header}.${payload}.${sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url")}`;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/oauth/token")) return Response.json({
        access_token: "fictional-access", refresh_token: "fictional-refresh", id_token: idToken,
        token_type: "Bearer", expires_in: 3600, scope,
      });
      if (url.endsWith("/.well-known/openid-configuration")) return Response.json({
        issuer: "https://auth.openai.com", jwks_uri: "https://auth.openai.com/.well-known/jwks.json",
      });
      if (url.endsWith("/.well-known/jwks.json")) return Response.json({
        keys: [{ ...publicKey.export({ format: "jwk" }), kid: "fictional-key", kty: "RSA" }],
      });
      if (url.endsWith("/v1/models")) return Response.json({ data: [{ id: "gpt-test" }] });
      throw new Error(`Unexpected URL: ${url}`);
    }));

    const callback = new URLSearchParams({ state: authorization.searchParams.get("state")!, code: "fictional-code" });
    await expect(completeChatGptSignIn(callback, adminSession)).resolves.toMatchObject({ connected: true, planEnabled });
    expect(Boolean(await getChatGptSession())).toBe(planEnabled);
    await expect(completeChatGptSignIn(callback, adminSession)).rejects.toThrow(/No hay ningún inicio/);
  });
});
