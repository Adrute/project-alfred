import { describe, expect, it } from "vitest";
import { validateDevelopmentBranch } from "../../scripts/check-development-branch";

describe("development branch policy", () => {
  it.each(["main", "master", ""])('rejects protected or missing branch "%s"', (branch) => {
    expect(validateDevelopmentBranch(branch)).not.toEqual([]);
  });

  it.each([
    "feature/context-catalog",
    "fix/chat-follow-up",
    "docs/feature-index",
    "chore/agent-rules",
    "refactor/planning-service",
    "test/a2a-regression",
    "release/1.0.0",
  ])('accepts work branch "%s"', (branch) => {
    expect(validateDevelopmentBranch(branch)).toEqual([]);
  });

  it.each(["context-catalog", "Feature/context", "feature/", "feature/context catalog"])(
    'rejects unsupported branch "%s"',
    (branch) => {
      expect(validateDevelopmentBranch(branch)).not.toEqual([]);
    },
  );
});
