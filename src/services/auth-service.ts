import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { authRepository } from "@/repositories/auth-repository";
import { HttpError, passwordSchema, roleSchema, usernameSchema, type AuthUser } from "@/domain/auth";
import { loadConfig } from "@/config/env";

export const SESSION_SECONDS = 12 * 60 * 60;
export const SESSION_COOKIE = "alfred_session";
let hashing = 0;
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (hashing >= 4) throw new HttpError(429, "Demasiados intentos. Inténtalo más tarde.");
  hashing++;
  try {
    return await new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
  } finally { hashing--; }
}
export async function hashPassword(password: string) {
  passwordSchema.parse(password);
  const salt = randomBytes(16);
  return `scrypt-v1$${salt.toString("hex")}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  if (!passwordSchema.safeParse(password).success) return false;
  const parts = /^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded);
  if (!parts) return false;
  return timingSafeEqual(await derive(password, Buffer.from(parts[1], "hex")), Buffer.from(parts[2], "hex"));
}
export const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const csrfToken = (token: string) => createHmac("sha256", token).update("alfred-csrf-v1").digest("hex");
export function constantEqual(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function sessionCookie(token: string, clear = false) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_SECONDS}${loadConfig().NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function requestToken(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
export async function authenticate(request: Request): Promise<{ user: AuthUser; token: string }> {
  const token = requestToken(request);
  const session = token ? await authRepository.findSession(hashSessionToken(token)) : null;
  if (!token || !session || session.revokedAt || session.expiresAt.getTime() <= Date.now() || !session.user.active) throw new HttpError(401, "Inicia sesión para continuar.");
  const { id, username, displayName } = session.user;
  return { user: { id, username, displayName, role: roleSchema.parse(session.user.role) }, token };
}
const attempts = new Map<string, { count: number; until: number }>();
export function checkLoginRate(username: string, now = Date.now()) {
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  for (const [key, limit] of [["global", 30], [`user:${username}`, 5]] as const) {
    const value = attempts.get(key) ?? { count: 0, until: now + 15 * 60_000 };
    if (value.count >= limit) throw new HttpError(429, "Demasiados intentos. Inténtalo más tarde.");
    value.count++; attempts.set(key, value);
  }
}
export async function login(username: string, password: string) {
  checkLoginRate(username);
  const user = await authRepository.findUser(username);
  const dummy = "scrypt-v1$" + "00".repeat(16) + "$" + "00".repeat(64);
  const valid = await verifyPassword(password, user?.passwordHash ?? dummy);
  if (!valid || !user?.active) throw new HttpError(401, "Usuario o contraseña incorrectos.");
  const token = randomBytes(32).toString("base64url");
  const created = await authRepository.createSessionForCredentials(
    user.id,
    user.passwordHash,
    hashSessionToken(token),
    new Date(Date.now() + SESSION_SECONDS * 1000),
  );
  if (!created) throw new HttpError(401, "Usuario o contraseña incorrectos.");
  return { token, user: { id: user.id, username: user.username, displayName: user.displayName, role: roleSchema.parse(user.role) } };
}
export async function logout(token: string) { await authRepository.revokeSession(hashSessionToken(token)); }

export const listAppUsers = () => authRepository.listUsers();
export async function manageAppUser(operation: "create" | "update" | "disable", username: string, displayName?: string, role?: string, password?: string) {
  const name = usernameSchema.parse(username);
  const existing = await authRepository.findUser(name);
  if (operation === "create" && existing) throw new Error("El usuario ya existe.");
  if (operation !== "create" && !existing) throw new Error("El usuario no existe.");
  if (operation === "disable") return authRepository.disableUser(name);
  const parsedRole = roleSchema.parse(role ?? existing?.role ?? "user");
  const label = (displayName ?? existing?.displayName ?? name).trim();
  if (!label || label.length > 100) throw new Error("Nombre visible no válido.");
  return authRepository.saveUser(name, label, parsedRole, await hashPassword(passwordSchema.parse(password)));
}
