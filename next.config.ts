import type { NextConfig } from "next";
import { loadConfig } from "./src/config/env";

// Fail fast on invalid paths, ports, hosts, or non-local AI endpoints.
loadConfig();

const nextConfig: NextConfig = {
  distDir: process.env.ALFRED_E2E === "1" ? ".next-e2e" : ".next",
  poweredByHeader: false,
  async headers() {
    const production = process.env.NODE_ENV === "production";
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: `default-src 'self'; script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'${production ? "" : " ws: wss:"}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` },
      ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
    ] }];
  },
};

export default nextConfig;
