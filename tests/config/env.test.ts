import { describe, expect, it } from "vitest";
import { loadConfig } from "@/config/env";

describe("runtime configuration", () => {
  it("applies private local defaults", () => {
    const config = loadConfig({});
    expect(config.HOST).toBe("127.0.0.1");
    expect(config.OLLAMA_BASE_URL).toBe("http://127.0.0.1:11434");
    expect(config.DATABASE_URL).toMatch(/^file:/);
  });

  it("rejects exposing the application to the local network", () => {
    expect(() => loadConfig({ HOST: "0.0.0.0" })).toThrow();
  });

  it("rejects remote AI providers", () => {
    expect(() => loadConfig({ OLLAMA_BASE_URL: "https://example.com" })).toThrow(
      /loopback/,
    );
  });
});
