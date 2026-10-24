import { z } from "zod";

export const roleSchema = z.enum(["admin", "user"]);
export type AppRole = z.infer<typeof roleSchema>;
export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.-]{2,63}$/);
export const passwordSchema = z.string().min(12).max(128);
export const loginSchema = z.object({ username: usernameSchema, password: passwordSchema });
export interface AuthUser { id: string; username: string; displayName: string; role: AppRole }
export class HttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
