import { database } from "@/lib/database";
import type { AppRole } from "@/domain/auth";
import { randomUUID } from "node:crypto";

export const authRepository = {
  findUser: (username: string) => database.appUser.findUnique({ where: { username } }),
  listUsers: () => database.appUser.findMany({ select: { id: true, username: true, displayName: true, role: true, active: true } }),
  async createSessionForCredentials(userId: string, passwordHash: string, tokenHash: string, expiresAt: Date) {
    const inserted = await database.$executeRaw`
      INSERT INTO "AppSession" ("id", "tokenHash", "userId", "expiresAt")
      SELECT ${randomUUID()}, ${tokenHash}, ${userId}, ${expiresAt}
      FROM "AppUser"
      WHERE "id" = ${userId} AND "passwordHash" = ${passwordHash} AND "active" = ${true}
    `;
    return inserted === 1;
  },
  findSession: (tokenHash: string) => database.appSession.findUnique({ where: { tokenHash }, include: { user: true } }),
  revokeSession: (tokenHash: string) => database.appSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } }),
  async saveUser(username: string, displayName: string, role: AppRole, passwordHash: string) {
    return database.$transaction(async (tx) => {
      const user = await tx.appUser.upsert({ where: { username }, create: { username, displayName, role, passwordHash }, update: { displayName, role, passwordHash, active: true } });
      await tx.appSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      return user;
    });
  },
  async disableUser(username: string) {
    return database.$transaction(async (tx) => {
      const user = await tx.appUser.update({ where: { username }, data: { active: false } });
      await tx.appSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  },
};
