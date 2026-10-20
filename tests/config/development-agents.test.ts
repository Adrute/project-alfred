import { describe, expect, it } from "vitest";
import { validateDevelopmentAgents } from "../../scripts/validate-development-agents";

describe("development agent catalog", () => {
  it("keeps neutral roles and provider adapters synchronized", async () => {
    await expect(validateDevelopmentAgents()).resolves.toEqual([]);
  });
});
