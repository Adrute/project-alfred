import { z } from "zod";

export const cloudAiLogQuerySchema = z.object({
  query: z.string().trim().max(200).default(""),
  status: z.enum(["all", "running", "completed", "failed"]).default("all"),
  model: z.string().trim().max(120).default("all"),
  operation: z.string().trim().max(120).default("all"),
  range: z.enum(["24h", "7d", "30d", "all"]).default("7d"),
  limit: z.coerce.number().int().min(1).max(200).default(100),
}).strict();

export const deleteCloudAiLogsSchema = z.object({
  confirmation: z.literal("BORRAR LOGS"),
}).strict();

export type CloudAiLogQuery = z.infer<typeof cloudAiLogQuerySchema>;
