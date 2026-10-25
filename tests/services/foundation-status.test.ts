import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { getFoundationStatus } from "@/services/foundation-status";

vi.mock("@/lib/database", () => ({
  database: {
    classroom: { count: async () => 0 },
    student: { count: async () => 0 },
  },
}));

afterEach(() => vi.unstubAllEnvs());

it("provides ChatGPT availability for the first page render", async () => {
  vi.stubEnv("CLOUD_AI_ENABLED", "true");
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3456");
  vi.stubEnv("PORT", "3456");
  vi.stubEnv("DATA_DIRECTORY", await mkdtemp(path.join(os.tmpdir(), "alfred-foundation-test-")));

  expect((await getFoundationStatus()).ai).toMatchObject({
    cloudEnabled: true,
    canSignInHere: true,
    connected: false,
    planEnabled: false,
  });
});
