import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_TELEMETRY_DISABLED: z.literal("1").default("1"),
  HOST: z.literal("127.0.0.1").default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  OLLAMA_BASE_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:11434")
    .refine(isLoopbackUrl, "OLLAMA_BASE_URL must use a loopback host"),
  OLLAMA_MODEL: z.string().trim().min(1).default("qwen3.5:9b"),
  OLLAMA_CONTEXT_LENGTH: z.coerce.number().int().min(4_096).max(32_768).default(8_192),
  OLLAMA_DEMO_MODE: booleanFromString,
  DATABASE_URL: z.string().startsWith("file:").default("file:./data/alfred.db"),
  DATA_DIRECTORY: z.string().trim().min(1).default("./data"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type RuntimeConfig = z.infer<typeof environmentSchema>;

export function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function loadConfig(
  source: Record<string, string | undefined> = process.env,
): RuntimeConfig {
  return environmentSchema.parse(source);
}
