import "dotenv/config";
import path from "node:path";
import { exportChatGptCredentials, importChatGptCredentials } from "../src/services/chatgpt-auth-service";

const [operation, filePath, ...extra] = process.argv.slice(2);

try {
  if (extra.length || !filePath || !["export", "import"].includes(operation)) {
    throw new Error("Uso: npm run ai:credentials -- export|import <ruta>");
  }
  const resolved = path.resolve(filePath);
  if (operation === "export") {
    const relativeToProject = path.relative(process.cwd(), resolved);
    if (!relativeToProject.startsWith("..") && !path.isAbsolute(relativeToProject)) {
      throw new Error("Exporta las credenciales fuera del repositorio de Alfred.");
    }
    await exportChatGptCredentials(resolved);
    console.info(`Credenciales de ChatGPT exportadas en ${resolved}. Protégelas y elimínalas tras importarlas.`);
  } else {
    await importChatGptCredentials(resolved);
    console.info("Credenciales de ChatGPT importadas. La identidad propia de este host se ha conservado.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "No se pudo completar la operación.");
  process.exitCode = 1;
}
