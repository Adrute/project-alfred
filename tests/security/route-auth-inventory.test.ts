import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

it("requires explicit authentication wrappers on every data handler", () => {
  for (const root of ["src/app/api", "src/app/.well-known"]) {
    for (const file of readdirSync(root, { recursive: true }).filter((file) => String(file).endsWith("route.ts"))) {
      const name = path.join(root, String(file));
      if (name === path.join("src/app/api/health/route.ts")) continue;
      const source = readFileSync(name, "utf8");
      expect(source, name).toContain("withApiAuth");
      if (name === path.join("src/app/api/auth/session/route.ts")) {
        expect(source).toContain("checkOrigin(request)");
        expect(source).toContain("readJson(request, 8 * 1024)");
        continue;
      }
      expect(source, name).not.toMatch(/export async function (GET|POST|PUT|PATCH|DELETE)/);
      for (const match of source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) = (.+);/g)) {
        expect(match[2], name).toMatch(/^withApiAuth\(/);
        if (/\/admin\/|\/a2a\/|\/auth\/chatgpt\/|\.well-known/.test(name)) expect(match[2], name).toContain('"admin"');
      }
    }
  }
});
