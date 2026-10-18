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
  it("contains no external HTTP endpoints or CDN resources", () => {
    const violations = sourceFiles(path.resolve("src")).flatMap((file) => {
      const urls = readFileSync(file, "utf8").match(/https?:\/\/[^\s"'`)]+/g) ?? [];
      return urls.filter((url) => !/^https?:\/\/(127\.0\.0\.1|localhost|\[?::1\]?)/.test(url)).map((url) => `${file}: ${url}`);
    });
    expect(violations).toEqual([]);
  });
});
