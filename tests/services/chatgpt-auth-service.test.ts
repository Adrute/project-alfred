import { mkdir, mkdtemp, readFile, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginChatGptSignIn,
  exportChatGptCredentials,
  getChatGptSession,
  importChatGptCredentials,
} from "@/services/chatgpt-auth-service";

const registration = {
  subject: "fictional-user",
  clientId: "fictional-client",
  accessToken: "fictional-access-token",
  refreshToken: "fictional-refresh-token",
  tokenType: "Bearer",
  expiresAt: "2099-01-01T00:00:00.000Z",
  scopes: ["chatgpt.tokens.use.direct"],
  selectedModel: "gpt-test",
};

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function temporaryDirectory() {
  return mkdtemp(path.join(os.tmpdir(), "alfred-chatgpt-test-"));
}

describe("ChatGPT open-source sign-in", () => {
  it("uses the exact official loopback callback", async () => {
    const directory = await temporaryDirectory();
    vi.stubEnv("CLOUD_AI_ENABLED", "true");
    vi.stubEnv("DATA_DIRECTORY", directory);
    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3456");
    vi.stubEnv("PORT", "3456");

    const authorization = new URL(await beginChatGptSignIn());

    expect(authorization.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3456/auth/callback");
  });

  it("does not start a loopback authorization from a remote deployment", async () => {
    vi.stubEnv("CLOUD_AI_ENABLED", "true");
    vi.stubEnv("APP_ORIGIN", "https://alfred.example.ts.net");
    await expect(beginChatGptSignIn()).rejects.toThrow(/localmente/);
  });

  it("rejects a loopback hostname that would not receive the host-only session cookie", async () => {
    vi.stubEnv("CLOUD_AI_ENABLED", "true");
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    vi.stubEnv("PORT", "3000");
    await expect(beginChatGptSignIn()).rejects.toThrow(/localmente/);
  });

  it("imports a protected session without replacing the destination host identity", async () => {
    const directory = await temporaryDirectory();
    const source = path.join(directory, "transfer.json");
    const destinationStore = path.join(directory, "auth", "chatgpt.json");
    await mkdir(path.dirname(destinationStore), { recursive: true });
    await writeFile(source, JSON.stringify({ version: 1, kind: "alfred-chatgpt-credentials", registration }), { mode: 0o600 });
    await writeFile(destinationStore, JSON.stringify({
      version: 1,
      hostId: "urn:uuid:11111111-1111-4111-8111-111111111111",
      aliasSecret: "destination-alias-secret-with-at-least-32-characters",
      registration: null,
      pending: null,
    }), { mode: 0o600 });
    vi.stubEnv("CLOUD_AI_ENABLED", "true");
    vi.stubEnv("DATA_DIRECTORY", directory);

    await importChatGptCredentials(source);
    const stored = JSON.parse(await readFile(destinationStore, "utf8")) as Record<string, unknown>;

    expect(stored.hostId).toBe("urn:uuid:11111111-1111-4111-8111-111111111111");
    expect(stored.aliasSecret).toBe("destination-alias-secret-with-at-least-32-characters");
    expect(stored.registration).toMatchObject({ clientId: "fictional-client", refreshToken: "fictional-refresh-token" });
  });

  it("exports only the transferable registration and protects the resulting file", async () => {
    const directory = await temporaryDirectory();
    const source = path.join(directory, "source.json");
    const exported = path.join(directory, "out", "credentials.json");
    await writeFile(source, JSON.stringify({ version: 1, kind: "alfred-chatgpt-credentials", registration }), { mode: 0o600 });
    vi.stubEnv("CLOUD_AI_ENABLED", "true");
    vi.stubEnv("DATA_DIRECTORY", directory);
    await importChatGptCredentials(source);

    await exportChatGptCredentials(exported);
    const transferred = JSON.parse(await readFile(exported, "utf8")) as Record<string, unknown>;

    expect(transferred).not.toHaveProperty("hostId");
    expect(transferred).not.toHaveProperty("aliasSecret");
    expect(transferred).toMatchObject({ kind: "alfred-chatgpt-credentials" });
    if (process.platform !== "win32") expect((await stat(exported)).mode & 0o077).toBe(0);
  });

  it("does not let an in-flight refresh overwrite newly imported credentials", async () => {
    const directory = await temporaryDirectory();
    const authDirectory = path.join(directory, "auth");
    const destinationStore = path.join(authDirectory, "chatgpt.json");
    const source = path.join(directory, "new-session.json");
    await mkdir(authDirectory, { recursive: true });
    await writeFile(destinationStore, JSON.stringify({
      version: 1,
      hostId: "urn:uuid:22222222-2222-4222-8222-222222222222",
      aliasSecret: "destination-alias-secret-with-at-least-32-characters",
      registration: { ...registration, clientId: "old-client", refreshToken: "old-refresh", expiresAt: "2020-01-01T00:00:00.000Z" },
      pending: null,
    }), { mode: 0o600 });
    await writeFile(source, JSON.stringify({
      version: 1,
      kind: "alfred-chatgpt-credentials",
      registration: { ...registration, clientId: "new-client", refreshToken: "new-refresh" },
    }), { mode: 0o600 });
    vi.stubEnv("CLOUD_AI_ENABLED", "true");
    vi.stubEnv("DATA_DIRECTORY", directory);
    let releaseRefresh!: (response: Response) => void;
    let markFetchStarted!: () => void;
    const fetchStarted = new Promise<void>((resolve) => { markFetchStarted = resolve; });
    vi.stubGlobal("fetch", vi.fn(() => {
      markFetchStarted();
      return new Promise<Response>((resolve) => { releaseRefresh = resolve; });
    }));

    const sessionPromise = getChatGptSession();
    await fetchStarted;
    const importPromise = importChatGptCredentials(source);
    releaseRefresh(Response.json({
      access_token: "refreshed-old-access",
      refresh_token: "refreshed-old-refresh",
      id_token: "fictional-id-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "chatgpt.tokens.use.direct",
    }));

    await expect(sessionPromise).resolves.toMatchObject({ accessToken: "refreshed-old-access" });
    await importPromise;
    const stored = JSON.parse(await readFile(destinationStore, "utf8")) as { registration: { clientId: string } };
    expect(stored.registration.clientId).toBe("new-client");
  });

  it("recovers an orphaned credential lock after an abrupt stop", async () => {
    const directory = await temporaryDirectory();
    const authDirectory = path.join(directory, "auth");
    const source = path.join(directory, "session.json");
    const lock = path.join(authDirectory, "chatgpt.lock");
    await mkdir(authDirectory, { recursive: true });
    await writeFile(lock, "", { mode: 0o600 });
    const stale = new Date(Date.now() - 60_000);
    await utimes(lock, stale, stale);
    await writeFile(source, JSON.stringify({ version: 1, kind: "alfred-chatgpt-credentials", registration }), { mode: 0o600 });
    vi.stubEnv("CLOUD_AI_ENABLED", "true");
    vi.stubEnv("DATA_DIRECTORY", directory);

    await expect(Promise.all([
      importChatGptCredentials(source),
      importChatGptCredentials(source),
    ])).resolves.toEqual([undefined, undefined]);
  });
});
