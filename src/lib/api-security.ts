import { AsyncLocalStorage } from "node:async_hooks";
import { loadConfig } from "@/config/env";
import { HttpError, type AppRole, type AuthUser } from "@/domain/auth";
import { authenticate, constantEqual, csrfToken } from "@/services/auth-service";

const identity = new AsyncLocalStorage<AuthUser>();
const jsonMediaType = /^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)(?:\s*;|$)/i;
export function requireAdminContext() {
  if (identity.getStore()?.role !== "admin") throw new HttpError(403, "Esta operación requiere permisos de administración.");
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== loadConfig().APP_ORIGIN || request.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Origen no autorizado.");
}
async function readBody(request: Request, limit: number): Promise<Buffer> {
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new HttpError(413, "La petición supera el tamaño permitido.");
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, "La petición supera el tamaño permitido."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function readJson(request: Request, limit = 256 * 1024): Promise<unknown> {
  if (!jsonMediaType.test(request.headers.get("content-type") ?? "")) throw new HttpError(415, "Se requiere un tipo JSON.");
  const body = await readBody(request, limit);
  if (body.byteLength === 0) throw new HttpError(400, "Se requiere un cuerpo JSON.");
  try { return JSON.parse(body.toString("utf8")) as unknown; }
  catch { throw new HttpError(400, "JSON no válido."); }
}

async function secureMutationRequest(request: Request): Promise<Request> {
  if (request.body === null) return request;
  const body = await readBody(request, 256 * 1024);
  if (body.byteLength === 0) return new Request(request.url, { method: request.method, headers: request.headers });
  if (!jsonMediaType.test(request.headers.get("content-type") ?? "")) throw new HttpError(415, "Se requiere un tipo JSON.");
  let parsed: unknown;
  try { parsed = JSON.parse(body.toString("utf8")) as unknown; }
  catch { throw new HttpError(400, "JSON no válido."); }
  return new Request(request.url, { method: request.method, headers: request.headers, body: JSON.stringify(parsed) });
}
export function apiError(error: unknown) {
  return Response.json({ error: error instanceof HttpError ? error.message : "No se pudo procesar la petición." }, { status: error instanceof HttpError ? error.status : 400, headers: { "cache-control": "no-store" } });
}
export function withApiAuth<C>(handler: (request: Request, context: C) => Promise<Response>, role: AppRole = "user") {
  return async (request: Request, context: C) => {
    try {
      const session = await authenticate(request);
      if (role === "admin" && session.user.role !== "admin") throw new HttpError(403, "Esta operación requiere permisos de administración.");
      let securedRequest = request;
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        checkOrigin(request);
        if (!constantEqual(request.headers.get("x-alfred-csrf") ?? "", csrfToken(session.token))) throw new HttpError(403, "La confirmación de seguridad no es válida.");
        securedRequest = await secureMutationRequest(request);
      }
      const response = await identity.run(session.user, () => handler(securedRequest, context));
      response.headers.set("cache-control", "no-store");
      return response;
    } catch (error) { return apiError(error); }
  };
}
