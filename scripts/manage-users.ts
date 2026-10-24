import "dotenv/config";
import { stdin, stdout } from "node:process";
import { listAppUsers, manageAppUser } from "../src/services/auth-service";
import { database } from "../src/lib/database";

async function readPassword(): Promise<string> {
  if (!stdin.isTTY) {
    let value = "";
    for await (const chunk of stdin) {
      value += String(chunk);
      if (Buffer.byteLength(value) > 1024) throw new Error("Entrada demasiado grande.");
    }
    return value.replace(/\r?\n$/, "");
  }
  stdout.write("Contraseña (mínimo 12 caracteres): ");
  stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => { stdin.off("data", receive); stdin.setRawMode(false); stdin.pause(); stdout.write("\n"); };
    const receive = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") { finish(); reject(new Error("Operación cancelada.")); return; }
        if (character === "\r" || character === "\n") { finish(); resolve(value); return; }
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " " && value.length < 129) value += character;
      }
    };
    stdin.on("data", receive);
  });
}

try {
  const [operation, username, role, displayName, ...extra] = process.argv.slice(2);
  if (extra.length || !["create", "update", "list", "disable"].includes(operation)) throw new Error("Uso: npm run auth:user -- create|update usuario admin|user [nombre] / disable usuario / list. La contraseña se lee de stdin.");
  if (operation === "list") console.table(await listAppUsers());
  else if (operation === "disable") { await manageAppUser("disable", username); console.info("Usuario desactivado y sesiones revocadas."); }
  else { await manageAppUser(operation as "create" | "update", username, displayName, role, await readPassword()); console.info("Usuario guardado y sesiones anteriores revocadas."); }
} catch {
  console.error("No se pudo completar la operación. Comprueba los argumentos, el usuario y una contraseña de 12–128 caracteres.");
  process.exitCode = 1;
} finally { await database.$disconnect(); }
