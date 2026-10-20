import { describe, expect, it } from "vitest";
import { exportRequestSchema, type ExportSheet } from "@/domain/data-export";
import { serializeCsv, serializeXlsx } from "@/services/data-export-service";

const sheet: ExportSheet = {
  id: "students",
  title: "Alumnado",
  description: "Prueba",
  columns: [{ key: "name", label: "Nombre" }, { key: "count", label: "Cantidad" }, { key: "createdAt", label: "Fecha" }],
  rows: [{ name: '=HYPERLINK("https://example.test")', count: 2, createdAt: new Date("2026-10-20T08:30:00.000Z") }],
};

describe("data export", () => {
  it("limits CSV to one dataset", () => {
    expect(exportRequestSchema.safeParse({ datasets: ["students", "classrooms"], format: "csv" }).success).toBe(false);
    expect(exportRequestSchema.safeParse({ datasets: ["students", "classrooms"], format: "xlsx" }).success).toBe(true);
  });

  it("serializes UTF-8 CSV and prevents spreadsheet formula injection", () => {
    const csv = serializeCsv(sheet);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
    expect(csv).toContain('"2026-10-20T08:30:00.000Z"');
  });

  it("creates a real XLSX zip payload", async () => {
    const buffer = await serializeXlsx([sheet]);
    expect(buffer.byteLength).toBeGreaterThan(1_000);
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});
