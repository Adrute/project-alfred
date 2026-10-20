import { z } from "zod";

export const agentAiModelSchema = z.object({
  model: z.string().trim().min(1).max(120).nullable(),
}).strict();
