import { z } from "zod";
import { newStudentSchema } from "@/domain/student-admin";
import { teachingScheduleEntrySchema } from "@/domain/planning";

const relationshipSchema = z.object({
  studentAId: z.string().min(1),
  studentBId: z.string().min(1),
  relationshipType: z.enum(["avoid_adjacent", "works_well"]),
  description: z.string().min(1),
  deactivateTypes: z.array(z.string()).default([]),
});

export const pendingActionPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("record_observation"),
    studentIds: z.array(z.string().min(1)).min(1),
    content: z.string().min(1),
    category: z.string().min(1),
    observedAt: z.string().datetime(),
    relationship: relationshipSchema.optional(),
  }),
  z.object({
    type: z.literal("save_tutoring"),
    studentId: z.string().min(1),
    preparation: z.string().min(1),
  }),
  z.object({
    type: z.literal("save_layout"),
    classroomId: z.string().min(1),
    name: z.string().min(1),
    rows: z.number().int().positive(),
    columns: z.number().int().positive(),
    configuration: z.string(),
    assignments: z.array(z.object({
      studentId: z.string().min(1),
      row: z.number().int().nonnegative(),
      column: z.number().int().nonnegative(),
    })),
  }),
  z.object({
    type: z.literal("plan_week"),
    weekStart: z.string().date(),
  }),
  z.object({
    type: z.literal("create_classroom"),
    name: z.string().trim().min(2).max(80),
    academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/),
    educationalStage: z.string().trim().min(2).max(80),
  }),
  z.object({
    type: z.literal("create_student"),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(120),
    classroomId: z.string().min(1),
  }),
  z.object({
    type: z.literal("create_students_bulk"),
    classroomId: z.string().min(1),
    students: z.array(newStudentSchema).min(1).max(100),
  }),
  z.object({
    type: z.literal("create_teaching_schedule"),
    academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/),
    timezone: z.literal("Europe/Madrid").default("Europe/Madrid"),
    entries: z.array(teachingScheduleEntrySchema).min(1).max(100),
  }),
  z.object({
    type: z.literal("control_agent"),
    agentId: z.string().min(1),
    action: z.enum(["start", "stop", "restart"]),
  }),
]);

export type PendingActionPayload = z.infer<typeof pendingActionPayloadSchema>;
