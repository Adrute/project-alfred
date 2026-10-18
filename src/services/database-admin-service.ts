import type { DatabaseTableKey, DeletionScope } from "@/domain/database-admin";
import { clearDatabaseScope, databaseTableCatalog, deleteDatabaseRecord, getDatabaseRecords, getDatabaseTableCounts } from "@/repositories/database-admin-repository";

const scopeLabels: Record<DeletionScope, string> = {
  conversations: "Conversaciones y acciones pendientes",
  students: "Alumnado y memoria asociada",
  planning: "Planificación y currículo",
  seating: "Distribuciones del aula",
  agentHistory: "Historial y conversaciones de agentes",
  all: "Toda la información",
};

function serializeValue(value: unknown): string | number | boolean | null {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 500 ? `${text.slice(0, 497)}…` : text;
}

export async function getDatabaseOverview(selectedTable: DatabaseTableKey = "students") {
  const [tables, rawRows] = await Promise.all([getDatabaseTableCounts(), getDatabaseRecords(selectedTable)]);
  const selected = databaseTableCatalog.find((table) => table.key === selectedTable)!;
  const rows = rawRows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, serializeValue(value)])));
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return {
    engine: "SQLite local",
    tables,
    totalRecords: tables.reduce((sum, table) => sum + table.count, 0),
    selected: { ...selected, count: tables.find((table) => table.key === selectedTable)?.count ?? 0, columns, rows },
  };
}

export function expectedScopeConfirmation(scope: DeletionScope) {
  return scope === "all" ? "BORRAR TODO" : `BORRAR ${scope.toUpperCase()}`;
}

export async function clearManagedData(scope: DeletionScope, confirmation: string) {
  if (confirmation !== expectedScopeConfirmation(scope)) throw new Error("La frase de confirmación no coincide.");
  await clearDatabaseScope(scope);
  return { scope, label: scopeLabels[scope] };
}

export async function removeManagedRecord(table: DatabaseTableKey, id: string, confirmation: string) {
  if (confirmation !== `BORRAR ${id}`) throw new Error("La frase de confirmación no coincide.");
  await deleteDatabaseRecord(table, id);
  return { table, id };
}

export const databaseDeletionScopes = Object.entries(scopeLabels).map(([key, label]) => ({
  key: key as DeletionScope,
  label,
  confirmation: expectedScopeConfirmation(key as DeletionScope),
  total: key === "all",
}));
