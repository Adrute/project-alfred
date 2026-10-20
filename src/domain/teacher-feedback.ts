import { z } from "zod";

export const teacherFeedbackInputSchema = z.object({
  studentId: z.string().min(1),
  teacherName: z.string().trim().max(120).nullable().default(null),
  subject: z.string().trim().max(120).nullable().default(null),
  originalComment: z.string().trim().min(3).max(4_000),
  receivedAt: z.string().date().optional(),
}).strict();

export const familyVersionSchema = z.object({
  familyVersion: z.string().trim().min(3).max(4_000),
}).strict();

export const confirmTeacherFeedbackSchema = familyVersionSchema.extend({
  feedbackId: z.string().min(1),
}).strict();

export type TeacherFeedbackInput = z.infer<typeof teacherFeedbackInputSchema>;
export type ConfirmTeacherFeedbackInput = z.infer<typeof confirmTeacherFeedbackSchema>;
