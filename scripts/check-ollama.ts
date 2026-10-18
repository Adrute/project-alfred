import "dotenv/config";
import { z } from "zod";
import { OllamaProvider } from "../src/ai/providers/ollama-provider";
import { loadConfig } from "../src/config/env";

const resultSchema = z.object({
  status: z.literal("ok"),
  language: z.literal("es"),
});

const config = loadConfig();
const provider = new OllamaProvider({
  baseUrl: config.OLLAMA_BASE_URL,
  model: config.OLLAMA_MODEL,
  timeoutMs: 120_000,
});

const health = await provider.health();
if (!health.available) {
  console.error(health.detail);
  process.exitCode = 1;
} else {
  const result = await provider.generateStructured(
    "Confirma que puedes responder en español usando los valores exactos solicitados.",
    resultSchema,
  );
  console.info(`Ollama verificado: ${config.OLLAMA_MODEL} respondió con JSON válido.`, result);
}
