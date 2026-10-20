import type { NextConfig } from "next";
import { loadConfig } from "./src/config/env";

// Fail fast on invalid paths, ports, hosts, or non-local AI endpoints.
loadConfig();

const nextConfig: NextConfig = {
  distDir: process.env.ALFRED_E2E === "1" ? ".next-e2e" : ".next",
  poweredByHeader: false,
};

export default nextConfig;
