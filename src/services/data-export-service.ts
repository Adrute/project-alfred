import writeExcelFile, { type Cell, type SheetData } from "write-excel-file/node";
import { exportDatasetCatalog, type ExportRequest, type ExportSheet, type ExportValue } from "@/domain/data-export";
import { loadExportSheet } from "@/repositories/data-export-repository";

const excelDateFormat = "dd/mm/yyyy hh:mm";

export function getExportCatalog() {
  return exportDatasetCatalog;
}

function protectSpreadsheetText(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvValue(value: ExportValue) {
  const normalized = value instanceof Date
    ? value.toISOString()
    : value === null
      ? ""
      : typeof value === "string"
        ? protectSpreadsheetText(value)
        : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function serializeCsv(sheet: ExportSheet) {
  const header = sheet.columns.map((column) => csvValue(column.label)).join(",");
  const rows = sheet.rows.map((row) => sheet.columns.map((column) => csvValue(row[column.key] ?? null)).join(","));
  return `\uFEFF${[header, ...rows].join("\r\n")}\r\n`;
}

function excelCell(value: ExportValue): Cell {
  if (value instanceof Date) return { value, type: Date, format: excelDateFormat };
  if (typeof value === "string") return { value: protectSpreadsheetText(value), type: String, wrap: false };
  if (typeof value === "number") return { value, type: Number };
  if (typeof value === "boolean") return { value, type: Boolean };
  return null;
}

export async function serializeXlsx(sheets: ExportSheet[]) {
  const workbook = sheets.map((sheet) => {
    const data: SheetData = [
      sheet.columns.map((column) => ({
        value: column.label,
        type: String,
        fontWeight: "bold" as const,
        backgroundColor: "#173F32",
        textColor: "#FFFFFF",
        align: "center" as const,
        height: 24,
      })),
      ...sheet.rows.map((row) => sheet.columns.map((column) => excelCell(row[column.key] ?? null))),
    ];
    return {
      sheet: sheet.title.slice(0, 31),
      stickyRowsCount: 1,
      columns: sheet.columns.map((column) => ({ width: column.width ?? 18 })),
      data,
    };
  });
  return writeExcelFile(workbook, { fontFamily: "Arial", fontSize: 10 }).toBuffer();
}

export async function createDataExport(input: ExportRequest, now = new Date()) {
  const sheets = await Promise.all(input.datasets.map(loadExportSheet));
  const date = now.toISOString().slice(0, 10);
  if (input.format === "csv") {
    const sheet = sheets[0];
    return {
      content: new TextEncoder().encode(serializeCsv(sheet)),
      contentType: "text/csv; charset=utf-8",
      filename: `alfred-${sheet.id}-${date}.csv`,
      sheets: sheets.map((item) => ({ id: item.id, rows: item.rows.length })),
    };
  }
  return {
    content: new Uint8Array(await serializeXlsx(sheets)),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `alfred-${sheets.length === 1 ? sheets[0].id : "datos"}-${date}.xlsx`,
    sheets: sheets.map((item) => ({ id: item.id, rows: item.rows.length })),
  };
}
