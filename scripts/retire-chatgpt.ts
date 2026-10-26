import "dotenv/config";
import { retireLocalChatGptCredentials } from "../src/services/chatgpt-auth-service";

try {
  await retireLocalChatGptCredentials();
  console.info("Credencial renovable retirada de esta instalación sin revocarla en OpenAI.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "No se pudo retirar la credencial.");
  process.exitCode = 1;
}
