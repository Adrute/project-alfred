import { describe, expect, it } from "vitest";
import { summarizeAgentTokenUsage } from "@/domain/agent-usage";

describe("agent token usage", () => {
  it("aggregates totals and averages only requests with measured usage", () => {
    expect(summarizeAgentTokenUsage([
      { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
      { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
      { inputTokens: null, outputTokens: null, totalTokens: null },
    ])).toEqual({
      requests: 3,
      measuredRequests: 2,
      inputTokens: 150,
      outputTokens: 50,
      totalTokens: 200,
      averageTokensPerRequest: 100,
    });
  });

  it("returns zeroes when an agent has no cloud requests", () => {
    expect(summarizeAgentTokenUsage([])).toEqual({
      requests: 0,
      measuredRequests: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      averageTokensPerRequest: 0,
    });
  });
});
