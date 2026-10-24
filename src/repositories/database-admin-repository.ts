import { database } from "@/lib/database";
import type { DatabaseTableKey, DeletionScope } from "@/domain/database-admin";

type DatabaseRecord = Record<string, unknown>;

export const databaseTableCatalog: Array<{ key: DatabaseTableKey; label: string; group: string }> = [
  { key: "students", label: "Alumnos", group: "Alumnado" },
  { key: "studentEnrollments", label: "Matrículas", group: "Alumnado" },
  { key: "studentObservations", label: "Observaciones", group: "Alumnado" },
  { key: "teacherFeedbacks", label: "Comentarios del profesorado", group: "Alumnado" },
  { key: "studentRelationships", label: "Relaciones", group: "Alumnado" },
  { key: "studentSubjectRecords", label: "Fichas por asignatura", group: "Alumnado" },
  { key: "assessmentGrades", label: "Calificaciones", group: "Alumnado" },
  { key: "tutoringSessions", label: "Tutorías", group: "Alumnado" },
  { key: "tutoringAgreements", label: "Acuerdos", group: "Alumnado" },
  { key: "classrooms", label: "Clases", group: "Organización" },
  { key: "seatingLayouts", label: "Distribuciones", group: "Organización" },
  { key: "seatingAssignments", label: "Pupitres", group: "Organización" },
  { key: "subjects", label: "Asignaturas", group: "Planificación" },
  { key: "teachingAssignments", label: "Docencia", group: "Planificación" },
  { key: "weeklyTimetables", label: "Horarios", group: "Planificación" },
  { key: "timetableSlots", label: "Franjas horarias", group: "Planificación" },
  { key: "planningExceptions", label: "Excepciones", group: "Planificación" },
  { key: "teachingUnits", label: "Unidades", group: "Planificación" },
  { key: "learningContents", label: "Contenidos", group: "Planificación" },
  { key: "lessonPlans", label: "Sesiones", group: "Planificación" },
  { key: "lessonActivities", label: "Actividades", group: "Planificación" },
  { key: "lessonExecutions", label: "Ejecuciones de clase", group: "Planificación" },
  { key: "planningChanges", label: "Cambios", group: "Planificación" },
  { key: "conversations", label: "Conversaciones", group: "Alfred" },
  { key: "messages", label: "Mensajes", group: "Alfred" },
  { key: "agentConversations", label: "Conversaciones A2A", group: "Alfred" },
  { key: "agentMessages", label: "Mensajes A2A", group: "Alfred" },
  { key: "pendingActions", label: "Acciones pendientes", group: "Alfred" },
  { key: "agentRuntimes", label: "Estado de agentes", group: "Sistema" },
  { key: "agentExecutions", label: "Actividad de agentes", group: "Sistema" },
  { key: "cloudAiTraces", label: "Logs de ChatGPT", group: "Sistema" },
];

async function countTable(key: DatabaseTableKey) {
  switch (key) {
    case "classrooms": return database.classroom.count();
    case "subjects": return database.subject.count();
    case "teachingAssignments": return database.teachingAssignment.count();
    case "weeklyTimetables": return database.weeklyTimetable.count();
    case "timetableSlots": return database.timetableSlot.count();
    case "planningExceptions": return database.planningException.count();
    case "teachingUnits": return database.teachingUnit.count();
    case "learningContents": return database.learningContent.count();
    case "lessonPlans": return database.lessonPlan.count();
    case "lessonActivities": return database.lessonActivity.count();
    case "lessonExecutions": return database.lessonExecution.count();
    case "planningChanges": return database.planningChange.count();
    case "students": return database.student.count();
    case "studentEnrollments": return database.studentEnrollment.count();
    case "studentObservations": return database.studentObservation.count();
    case "teacherFeedbacks": return database.teacherFeedback.count();
    case "studentRelationships": return database.studentRelationship.count();
    case "studentSubjectRecords": return database.studentSubjectRecord.count();
    case "assessmentGrades": return database.assessmentGrade.count();
    case "tutoringSessions": return database.tutoringSession.count();
    case "tutoringAgreements": return database.tutoringAgreement.count();
    case "conversations": return database.conversation.count();
    case "messages": return database.message.count();
    case "agentConversations": return database.agentConversation.count();
    case "agentMessages": return database.agentMessage.count();
    case "agentRuntimes": return database.agentRuntime.count();
    case "agentExecutions": return database.agentExecution.count();
    case "cloudAiTraces": return database.cloudAiTrace.count();
    case "seatingLayouts": return database.seatingLayout.count();
    case "seatingAssignments": return database.seatingAssignment.count();
    case "pendingActions": return database.pendingAction.count();
  }
}

export async function getDatabaseTableCounts() {
  return Promise.all(databaseTableCatalog.map(async (table) => ({ ...table, count: await countTable(table.key) })));
}

export async function getDatabaseRecords(key: DatabaseTableKey, take = 50): Promise<DatabaseRecord[]> {
  const order = { createdAt: "desc" as const };
  switch (key) {
    case "classrooms": return database.classroom.findMany({ orderBy: order, take });
    case "subjects": return database.subject.findMany({ orderBy: order, take });
    case "teachingAssignments": return database.teachingAssignment.findMany({ orderBy: order, take });
    case "weeklyTimetables": return database.weeklyTimetable.findMany({ orderBy: order, take });
    case "timetableSlots": return database.timetableSlot.findMany({ orderBy: order, take });
    case "planningExceptions": return database.planningException.findMany({ orderBy: order, take });
    case "teachingUnits": return database.teachingUnit.findMany({ orderBy: order, take });
    case "learningContents": return database.learningContent.findMany({ orderBy: order, take });
    case "lessonPlans": return database.lessonPlan.findMany({ orderBy: order, take });
    case "lessonActivities": return database.lessonActivity.findMany({ orderBy: order, take });
    case "lessonExecutions": return database.lessonExecution.findMany({ orderBy: order, take });
    case "planningChanges": return database.planningChange.findMany({ orderBy: order, take });
    case "students": return database.student.findMany({ orderBy: order, take });
    case "studentEnrollments": return database.studentEnrollment.findMany({ orderBy: { startDate: "desc" }, take });
    case "studentObservations": return database.studentObservation.findMany({ orderBy: order, take });
    case "teacherFeedbacks": return database.teacherFeedback.findMany({ orderBy: { receivedAt: "desc" }, take });
    case "studentRelationships": return database.studentRelationship.findMany({ orderBy: order, take });
    case "studentSubjectRecords": return database.studentSubjectRecord.findMany({ orderBy: order, take });
    case "assessmentGrades": return database.assessmentGrade.findMany({ orderBy: order, take });
    case "tutoringSessions": return database.tutoringSession.findMany({ orderBy: order, take });
    case "tutoringAgreements": return database.tutoringAgreement.findMany({ orderBy: order, take });
    case "conversations": return database.conversation.findMany({ orderBy: order, take });
    case "messages": return database.message.findMany({ orderBy: order, take });
    case "agentConversations": return database.agentConversation.findMany({ orderBy: order, take });
    case "agentMessages": return database.agentMessage.findMany({ orderBy: order, take });
    case "agentRuntimes": return database.agentRuntime.findMany({ orderBy: { updatedAt: "desc" }, take });
    case "agentExecutions": return database.agentExecution.findMany({ orderBy: { startedAt: "desc" }, take });
    case "cloudAiTraces": return database.cloudAiTrace.findMany({ orderBy: order, take, select: { id: true, createdAt: true, provider: true, operation: true, model: true, status: true, durationMs: true, inputTokens: true, outputTokens: true, totalTokens: true } });
    case "seatingLayouts": return database.seatingLayout.findMany({ orderBy: order, take });
    case "seatingAssignments": return database.seatingAssignment.findMany({ orderBy: [{ seatingLayoutId: "asc" }, { row: "asc" }, { column: "asc" }], take });
    case "pendingActions": return database.pendingAction.findMany({ orderBy: order, take });
  }
}

export async function deleteDatabaseRecord(key: DatabaseTableKey, id: string) {
  switch (key) {
    case "classrooms": return database.classroom.delete({ where: { id } });
    case "subjects": return database.subject.delete({ where: { id } });
    case "teachingAssignments": return database.teachingAssignment.delete({ where: { id } });
    case "weeklyTimetables": return database.weeklyTimetable.delete({ where: { id } });
    case "timetableSlots": return database.timetableSlot.delete({ where: { id } });
    case "planningExceptions": return database.planningException.delete({ where: { id } });
    case "teachingUnits": return database.teachingUnit.delete({ where: { id } });
    case "learningContents": return database.learningContent.delete({ where: { id } });
    case "lessonPlans": return database.lessonPlan.delete({ where: { id } });
    case "lessonActivities": return database.lessonActivity.delete({ where: { id } });
    case "lessonExecutions": return database.lessonExecution.delete({ where: { id } });
    case "planningChanges": return database.planningChange.delete({ where: { id } });
    case "students": return database.student.delete({ where: { id } });
    case "studentEnrollments": return database.studentEnrollment.delete({ where: { id } });
    case "studentObservations": return database.studentObservation.delete({ where: { id } });
    case "teacherFeedbacks": return database.teacherFeedback.delete({ where: { id } });
    case "studentRelationships": return database.studentRelationship.delete({ where: { id } });
    case "studentSubjectRecords": return database.studentSubjectRecord.delete({ where: { id } });
    case "assessmentGrades": return database.assessmentGrade.delete({ where: { id } });
    case "tutoringSessions": return database.tutoringSession.delete({ where: { id } });
    case "tutoringAgreements": return database.tutoringAgreement.delete({ where: { id } });
    case "conversations": return database.conversation.delete({ where: { id } });
    case "messages": return database.message.delete({ where: { id } });
    case "agentConversations": return database.agentConversation.delete({ where: { id } });
    case "agentMessages": return database.agentMessage.delete({ where: { id } });
    case "agentRuntimes": return database.agentRuntime.delete({ where: { agentId: id } });
    case "agentExecutions": return database.agentExecution.delete({ where: { id } });
    case "cloudAiTraces": return database.cloudAiTrace.delete({ where: { id } });
    case "seatingLayouts": return database.seatingLayout.delete({ where: { id } });
    case "seatingAssignments": return database.seatingAssignment.delete({ where: { id } });
    case "pendingActions": return database.pendingAction.delete({ where: { id } });
  }
}

export async function clearDatabaseScope(scope: DeletionScope) {
  return database.$transaction(async (transaction) => {
    if (scope === "conversations" || scope === "all") {
      await transaction.agentConversation.deleteMany();
      await transaction.conversation.deleteMany();
      await transaction.pendingAction.deleteMany();
    }
    if (scope === "students" || scope === "all") {
      if (scope === "students") await transaction.seatingLayout.deleteMany();
      await transaction.student.deleteMany();
    }
    if (scope === "seating") {
      await transaction.seatingLayout.deleteMany();
    }
    if (scope === "planning" || scope === "all") {
      await transaction.weeklyTimetable.deleteMany();
      await transaction.teachingAssignment.deleteMany();
      await transaction.subject.deleteMany();
      await transaction.planningChange.deleteMany();
    }
    if (scope === "all") {
      await transaction.classroom.deleteMany();
      await transaction.cloudAiTrace.deleteMany();
      await transaction.agentExecution.deleteMany();
      await transaction.agentRuntime.deleteMany();
    } else if (scope === "agentHistory") {
      await transaction.agentConversation.deleteMany();
      await transaction.cloudAiTrace.deleteMany();
      await transaction.agentExecution.deleteMany();
    }
  });
}
