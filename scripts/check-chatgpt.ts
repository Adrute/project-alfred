import "dotenv/config";
import { z } from "zod";
import { getConnectedLlmProvider } from "../src/ai/providers/provider-factory";

const resultSchema = z.object({
  status: z.literal("ok"),
  language: z.literal("es"),
});

const provider = await getConnectedLlmProvider({ operation: "connection_check" });
if (!provider) {
  console.error("ChatGPT no está conectado. Inicia Alfred y usa «Continuar con ChatGPT» antes de ejecutar esta comprobación.");
  process.exitCode = 1;
} else {
  const result = await provider.generateStructured(
    "Confirma que puedes responder en español usando los valores exactos solicitados.",
    resultSchema,
  );
  console.info(`ChatGPT verificado con ${provider.id}: respuesta estructurada válida.`, result);
}
