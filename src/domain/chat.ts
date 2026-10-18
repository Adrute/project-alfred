import { z } from "zod";

export const applicationViewSchema = z.enum([
  "home",
  "chat",
  "planning",
  "teaching",
  "classes",
  "students",
  "tutoring",
  "seating",
  "admin",
]);

export const chatPageContextSchema = z.object({
  view: applicationViewSchema,
  label: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(800),
  studentIds: z.array(z.string().min(1).max(120)).max(6).default([]),
  studentNames: z.array(z.string().trim().min(1).max(120)).max(6).default([]),
}).strict();

export type ChatPageContext = z.infer<typeof chatPageContextSchema>;
