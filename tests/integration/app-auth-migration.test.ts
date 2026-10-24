import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.resolve("prisma/migrations");
const authMigration = "20261024120000_app_auth";

describe("additive application authentication migration", () => {
  it("preserves teaching data and enforces identity/session constraints", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.pragma("foreign_keys = ON");
      for (const migration of readdirSync(migrationsDirectory).sort()) {
        if (migration >= authMigration) continue;
        sqlite.exec(readFileSync(path.join(migrationsDirectory, migration, "migration.sql"), "utf8"));
      }
      sqlite.prepare(`INSERT INTO "Classroom"
        ("id", "name", "academicYear", "educationalStage", "updatedAt")
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`).run("fixture-class", "Prueba ficticia", "2026-2027", "ESO");

      sqlite.exec(readFileSync(path.join(migrationsDirectory, authMigration, "migration.sql"), "utf8"));
      expect(sqlite.prepare('SELECT "name" FROM "Classroom" WHERE "id" = ?').get("fixture-class"))
        .toEqual({ name: "Prueba ficticia" });
      const insertUser = sqlite.prepare(`INSERT INTO "AppUser"
        ("id", "username", "displayName", "passwordHash", "updatedAt")
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`);
      insertUser.run("fixture-user", "profesora", "Profesora ficticia", "fixture-hash");
      expect(sqlite.prepare('SELECT "role", "active" FROM "AppUser"').get()).toEqual({ role: "user", active: 1 });
      expect(() => insertUser.run("other-user", "profesora", "Duplicada", "fixture-hash")).toThrow();
      const insertSession = sqlite.prepare(`INSERT INTO "AppSession"
        ("id", "tokenHash", "userId", "expiresAt") VALUES (?, ?, ?, ?)`);
      expect(() => insertSession.run("bad-session", "unknown-hash", "unknown-user", "2026-10-25T12:00:00Z")).toThrow();
      insertSession.run("fixture-session", "fixture-token-hash", "fixture-user", "2026-10-25T12:00:00Z");
      expect(() => insertSession.run("other-session", "fixture-token-hash", "fixture-user", "2026-10-25T12:00:00Z")).toThrow();
      expect(() => sqlite.prepare('DELETE FROM "AppUser" WHERE "id" = ?').run("fixture-user")).toThrow();
      sqlite.prepare('UPDATE "AppUser" SET "id" = ? WHERE "id" = ?').run("renamed-user", "fixture-user");
      expect(sqlite.prepare('SELECT "userId" FROM "AppSession"').get()).toEqual({ userId: "renamed-user" });
      expect(sqlite.pragma("foreign_key_check")).toEqual([]);
      expect(sqlite.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
    } finally {
      sqlite.close();
    }
  });

  it("deploys idempotently to an explicit isolated database without creating seed data", () => {
    const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "alfred-auth-migration-"));
    const databasePath = path.join(temporaryDirectory, "deployment.db");
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/deploy-database.ts"], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            DATABASE_URL: `file:${databasePath}`,
            DATA_DIRECTORY: temporaryDirectory,
          },
          encoding: "utf8",
          timeout: 30_000,
        });
        expect(result.error).toBeUndefined();
        expect(result.status, result.stderr).toBe(0);
      }
      const sqlite = new Database(databasePath, { readonly: true });
      try {
        expect(sqlite.prepare('SELECT COUNT(*) AS count FROM "Classroom"').get()).toEqual({ count: 0 });
        expect(sqlite.prepare('SELECT COUNT(*) AS count FROM "AppUser"').get()).toEqual({ count: 0 });
        expect(sqlite.prepare('SELECT COUNT(*) AS count FROM "_prisma_migrations" WHERE "migration_name" = ? AND "finished_at" IS NOT NULL').get(authMigration))
          .toEqual({ count: 1 });
        expect(sqlite.pragma("foreign_key_check")).toEqual([]);
      } finally {
        sqlite.close();
      }
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }, 60_000);
});
