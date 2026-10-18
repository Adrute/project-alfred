import type { NextConfig } from "next";
import { loadConfig } from "./src/config/env";

// Fail fast on invalid paths, ports, hosts, or non-local AI endpoints.
loadConfig();

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
