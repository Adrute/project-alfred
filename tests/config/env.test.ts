import { describe, expect, it } from "vitest";
import { loadConfig } from "@/config/env";

describe("runtime configuration", () => {
  it("applies private local defaults", () => {
    const config = loadConfig({});
    expect(config.HOST).toBe("127.0.0.1");
    expect(config.OLLAMA_BASE_URL).toBe("http://127.0.0.1:11434");
    expect(config.CHATGPT_MODEL).toBe("gpt-6.1-sol");
    expect(config.DATABASE_URL).toMatch(/^file:/);
  });

  it("permits an explicit container bind while retaining loopback defaults", () => {
    expect(loadConfig({ HOST: "0.0.0.0" }).HOST).toBe("0.0.0.0");
    expect(() => loadConfig({ HOST: "192.168.1.1" })).toThrow();
  });

  it("requires an exact trusted HTTPS production origin", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/APP_ORIGIN/);
    expect(() => loadConfig({ APP_ORIGIN: "http://example.com" })).toThrow();
    expect(() => loadConfig({ APP_ORIGIN: "https://example.com/path" })).toThrow();
    expect(loadConfig({ NODE_ENV: "production", APP_ORIGIN: "https://example.ts.net" }).CLOUD_AI_ENABLED).toBe(false);
  });

  it("rejects remote AI providers", () => {
    expect(() => loadConfig({ OLLAMA_BASE_URL: "https://example.com" })).toThrow(
      /loopback/,
    );
  });
});
