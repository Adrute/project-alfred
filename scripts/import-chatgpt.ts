import "dotenv/config";
import { importChatGptCredentials } from "../src/services/chatgpt-auth-service";

const sourcePath = process.argv[2];
if (!sourcePath || process.argv.length !== 3) {
  console.error("Uso: npm run ai:import-chatgpt -- <ruta-privada-del-archivo-chatgpt.json>");
  process.exitCode = 1;
} else {
  try {
    await importChatGptCredentials(sourcePath);
    console.info("Credencial ChatGPT importada. El identificador de host y los alias de esta instancia se han conservado.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "No se pudo importar la credencial.");
    process.exitCode = 1;
  }
}
