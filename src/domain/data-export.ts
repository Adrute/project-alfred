import { z } from "zod";

export const exportDatasetIds = [
  "students",
  "classrooms",
  "teaching",
  "tutorings",
  "planning",
  "observations",
  "teacherFeedback",
  "agentActivity",
  "cloudAiUsage",
] as const;

export const exportDatasetIdSchema = z.enum(exportDatasetIds);
export type ExportDatasetId = z.infer<typeof exportDatasetIdSchema>;

export const exportRequestSchema = z.object({
  datasets: z.array(exportDatasetIdSchema).min(1, "Selecciona al menos un conjunto de datos.").max(exportDatasetIds.length),
  format: z.enum(["csv", "xlsx"]),
}).superRefine((input, context) => {
  if (new Set(input.datasets).size !== input.datasets.length) {
    context.addIssue({ code: "custom", path: ["datasets"], message: "No repitas conjuntos de datos." });
  }
  if (input.format === "csv" && input.datasets.length !== 1) {
    context.addIssue({ code: "custom", path: ["datasets"], message: "CSV admite un único conjunto; usa Excel para varias hojas." });
  }
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type ExportValue = string | number | boolean | Date | null;

export interface ExportColumn {
  key: string;
  label: string;
  width?: number;
}

export interface ExportSheet {
  id: ExportDatasetId;
  title: string;
  description: string;
  columns: ExportColumn[];
  rows: Array<Record<string, ExportValue>>;
}

export const exportDatasetCatalog: Array<{
  id: ExportDatasetId;
  title: string;
  description: string;
  includesPersonalData: boolean;
}> = [
  { id: "students", title: "Alumnado", description: "Datos básicos y grupos actuales del alumnado.", includesPersonalData: true },
  { id: "classrooms", title: "Grupos", description: "Clases, curso académico, etapa y número de matrículas.", includesPersonalData: false },
  { id: "teaching", title: "Seguimiento académico", description: "Asignaturas, estados, calificaciones y notas docentes.", includesPersonalData: true },
  { id: "tutorings", title: "Tutorías", description: "Sesiones tutoriales, preparación, notas y acuerdos.", includesPersonalData: true },
  { id: "planning", title: "Planificación", description: "Sesiones de clase planificadas con fecha, horario y estado.", includesPersonalData: false },
  { id: "observations", title: "Observaciones", description: "Histórico confirmado de observaciones del alumnado.", includesPersonalData: true },
  { id: "teacherFeedback", title: "Comentarios del profesorado", description: "Comentarios originales y versiones confirmadas para familias.", includesPersonalData: true },
  { id: "agentActivity", title: "Actividad de agentes", description: "Operaciones, estados y duraciones de los agentes.", includesPersonalData: false },
  { id: "cloudAiUsage", title: "Consumo de IA", description: "Metadatos, tokens y duración; excluye peticiones y respuestas.", includesPersonalData: false },
];
