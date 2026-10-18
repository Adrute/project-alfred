import { z } from "zod";

export const databaseTableKeySchema = z.enum([
  "classrooms",
  "subjects",
  "teachingAssignments",
  "weeklyTimetables",
  "timetableSlots",
  "planningExceptions",
  "teachingUnits",
  "learningContents",
  "lessonPlans",
  "lessonActivities",
  "lessonExecutions",
  "planningChanges",
  "students",
  "studentEnrollments",
  "studentObservations",
  "studentRelationships",
  "studentSubjectRecords",
  "assessmentGrades",
  "tutoringSessions",
  "tutoringAgreements",
  "conversations",
  "messages",
  "agentConversations",
  "agentMessages",
  "agentRuntimes",
  "agentExecutions",
  "seatingLayouts",
  "seatingAssignments",
  "pendingActions",
]);

export const deletionScopeSchema = z.enum([
  "conversations",
  "students",
  "planning",
  "seating",
  "agentHistory",
  "all",
]);

export const clearDatabaseInputSchema = z.object({
  scope: deletionScopeSchema,
  confirmation: z.string().trim().max(80),
}).strict();

export const deleteDatabaseRecordInputSchema = z.object({
  confirmation: z.string().trim().max(180),
}).strict();

export type DatabaseTableKey = z.infer<typeof databaseTableKeySchema>;
export type DeletionScope = z.infer<typeof deletionScopeSchema>;
