import { z } from "zod";

export const progressStatuses = ["not_assessed", "needs_support", "developing", "on_track", "advanced"] as const;
export const participationStatuses = ["not_assessed", "low", "variable", "consistent", "high"] as const;
export const homeworkStatuses = ["not_assessed", "behind", "irregular", "up_to_date"] as const;

export const studentSubjectRecordInputSchema = z.object({
  teachingAssignmentId: z.string().min(1),
  studentId: z.string().min(1),
  progressStatus: z.enum(progressStatuses).default("not_assessed"),
  participationStatus: z.enum(participationStatuses).default("not_assessed"),
  homeworkStatus: z.enum(homeworkStatuses).default("not_assessed"),
  teacherNotes: z.string().trim().max(4_000).nullable().default(null),
  supportNotes: z.string().trim().max(4_000).nullable().default(null),
}).strict();

export const assessmentGradeInputSchema = z.object({
  teachingAssignmentId: z.string().min(1),
  studentId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  assessmentPeriod: z.string().trim().min(1).max(80),
  score: z.number().min(0).max(100),
  maxScore: z.number().positive().max(100).default(10),
  weight: z.number().positive().max(100).default(1),
  assessedAt: z.string().date(),
  notes: z.string().trim().max(1_000).nullable().default(null),
}).strict().refine((value) => value.score <= value.maxScore, {
  message: "La calificación no puede superar la puntuación máxima.",
  path: ["score"],
});

export const tutorGroupInputSchema = z.object({
  classroomId: z.string().min(1),
  tutorNotes: z.string().trim().max(4_000).nullable().optional(),
}).strict();

export type StudentSubjectRecordInput = z.infer<typeof studentSubjectRecordInputSchema>;
export type AssessmentGradeInput = z.infer<typeof assessmentGradeInputSchema>;
export type TutorGroupInput = z.infer<typeof tutorGroupInputSchema>;

export function weightedGradeAverage(grades: Array<{ score: number; maxScore: number; weight: number }>): number | null {
  const valid = grades.filter((grade) => grade.maxScore > 0 && grade.weight > 0);
  if (!valid.length) return null;
  const totalWeight = valid.reduce((sum, grade) => sum + grade.weight, 0);
  const normalized = valid.reduce((sum, grade) => sum + (grade.score / grade.maxScore) * 10 * grade.weight, 0);
  return Math.round((normalized / totalWeight) * 10) / 10;
}
