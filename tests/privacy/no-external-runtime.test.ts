import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (entry === "generated") return [];
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(ts|tsx|css)$/.test(entry) ? [full] : [];
  });
}

describe("runtime privacy", () => {
  it("only contains the explicitly approved OpenAI cloud endpoints", () => {
    const approvedFiles = new Set([
      path.resolve("src/ai/providers/openai-responses-provider.ts"),
      path.resolve("src/services/chatgpt-auth-service.ts"),
    ]);
    const violations = sourceFiles(path.resolve("src")).flatMap((file) => {
      const urls = readFileSync(file, "utf8").match(/https?:\/\/[^\s"'`)]+/g) ?? [];
      return urls.filter((url) => {
        if (/^https?:\/\/(127\.0\.0\.1|localhost|\[?::1\]?)/.test(url)) return false;
        const approvedHost = /^https:\/\/(auth|api)\.openai\.com(?:\/|$)/.test(url);
        return !approvedHost || !approvedFiles.has(path.resolve(file));
      }).map((url) => `${file}: ${url}`);
    });
    expect(violations).toEqual([]);
  });
});
