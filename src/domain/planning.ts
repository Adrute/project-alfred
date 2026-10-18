import { z } from "zod";

export const lessonStatuses = ["unplanned", "planned", "taught", "partially_taught", "cancelled"] as const;
export const activityTypes = ["explanation", "review", "exercises", "individual", "cooperative", "reading", "writing", "oral", "assessment", "other"] as const;
export const timetableActivityTypes = ["class", "tutoring", "duty", "meeting", "preparation", "other"] as const;

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato AAAA-MM-DD.");

export const timetableSlotInputSchema = z.object({
  weeklyTimetableId: z.string().min(1),
  teachingAssignmentId: z.string().min(1),
  dayOfWeek: z.number().int().min(1).max(7),
  startMinute: z.number().int().min(0).max(1_439),
  endMinute: z.number().int().min(1).max(1_440),
  activityType: z.enum(timetableActivityTypes).default("class"),
  room: z.string().trim().max(80).optional().nullable(),
}).refine((value) => value.endMinute > value.startMinute, {
  message: "La hora de fin debe ser posterior a la de inicio.",
  path: ["endMinute"],
}).refine((value) => value.endMinute - value.startMinute >= 15, {
  message: "Una franja docente debe durar al menos 15 minutos.",
  path: ["endMinute"],
});

export const teachingScheduleEntrySchema = z.object({
  classroomName: z.string().trim().min(2).max(80),
  educationalStage: z.string().trim().min(2).max(80),
  subjectName: z.string().trim().min(2).max(100),
  dayOfWeek: z.number().int().min(1).max(7),
  startMinute: z.number().int().min(0).max(1_439),
  endMinute: z.number().int().min(1).max(1_440),
  room: z.string().trim().max(80).optional().nullable(),
}).refine((value) => value.endMinute > value.startMinute, {
  message: "La hora de fin debe ser posterior a la de inicio.",
  path: ["endMinute"],
}).refine((value) => value.endMinute - value.startMinute >= 15, {
  message: "Una clase debe durar al menos 15 minutos.",
  path: ["endMinute"],
});

export const teachingScheduleSchema = z.object({
  academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/),
  timezone: z.literal("Europe/Madrid").default("Europe/Madrid"),
  entries: z.array(teachingScheduleEntrySchema).min(1).max(100),
});

export const lessonPlanUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  objectives: z.array(z.string().trim().min(1)).max(12).optional(),
  materials: z.array(z.string().trim().min(1)).max(20).optional(),
  homework: z.string().trim().max(1_000).nullable().optional(),
  postLessonNotes: z.string().trim().max(3_000).nullable().optional(),
  status: z.enum(lessonStatuses).optional(),
});

export const lessonActivityInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).optional().nullable(),
  durationMinutes: z.number().int().positive().max(300),
  activityType: z.enum(activityTypes),
  learningContentId: z.string().min(1).optional().nullable(),
});

export type TimetableSlotInput = z.infer<typeof timetableSlotInputSchema>;
export type TeachingSchedule = z.infer<typeof teachingScheduleSchema>;
export type LessonPlanUpdate = z.infer<typeof lessonPlanUpdateSchema>;

export function dateFromKey(value: string): Date {
  return new Date(`${dateKeySchema.parse(value)}T00:00:00.000Z`);
}

export function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function localDateKey(value = new Date(), timezone = "Europe/Madrid"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function mondayOfWeek(value: string): string {
  const date = dateFromKey(value);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return dateKey(date);
}

export function addDays(value: string, days: number): string {
  const date = dateFromKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

export function weekDateKeys(weekStart: string): string[] {
  const monday = mondayOfWeek(weekStart);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function minuteLabel(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function hasTimeOverlap(
  first: { startMinute: number; endMinute: number },
  second: { startMinute: number; endMinute: number },
): boolean {
  return first.startMinute < second.endMinute && second.startMinute < first.endMinute;
}

export function validateActivityDuration(
  startMinute: number,
  endMinute: number,
  activities: Array<{ durationMinutes: number }>,
): { valid: boolean; availableMinutes: number; plannedMinutes: number } {
  const availableMinutes = endMinute - startMinute;
  const plannedMinutes = activities.reduce((sum, item) => sum + item.durationMinutes, 0);
  return { valid: plannedMinutes <= availableMinutes, availableMinutes, plannedMinutes };
}
