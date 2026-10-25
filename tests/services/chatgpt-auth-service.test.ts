import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { beginChatGptSignIn, completeChatGptSignIn, getChatGptSession, getChatGptStatus } from "@/services/chatgpt-auth-service";

const adminSession = "a".repeat(43);

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function configure(origin: string, clientId?: string) {
  vi.stubEnv("CLOUD_AI_ENABLED", "true");
  vi.stubEnv("DATA_DIRECTORY", await mkdtemp(path.join(os.tmpdir(), "alfred-oauth-test-")));
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("PORT", origin.endsWith(":3456") ? "3456" : "3000");
  if (clientId) vi.stubEnv("CHATGPT_OAUTH_CLIENT_ID", clientId);
}

describe("ChatGPT OAuth sign-in", () => {
  it("uses the loopback callback for local open-source sign-in", async () => {
    await configure("http://127.0.0.1:3456");
    const authorization = new URL(await beginChatGptSignIn(adminSession));
    expect(authorization.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3456/auth/callback");
    expect(authorization.searchParams.get("client_id")).toBe("dynamic_agent_client");
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
