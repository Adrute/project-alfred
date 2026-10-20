import { database } from "@/lib/database";
import type { ExportDatasetId, ExportSheet } from "@/domain/data-export";
import { weightedGradeAverage } from "@/domain/teaching";

export async function loadExportSheet(dataset: ExportDatasetId): Promise<ExportSheet> {
  switch (dataset) {
    case "students": {
      const rows = await database.student.findMany({
        include: { enrollments: { where: { endDate: null }, include: { classroom: true } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
      return {
        id: dataset, title: "Alumnado", description: "Alumnado y grupos activos",
        columns: [
          { key: "id", label: "ID", width: 26 }, { key: "firstName", label: "Nombre", width: 18 },
          { key: "lastName", label: "Apellidos", width: 24 }, { key: "classrooms", label: "Grupos activos", width: 32 },
          { key: "createdAt", label: "Fecha de alta", width: 19 },
        ],
        rows: rows.map((student) => ({
          id: student.id, firstName: student.firstName, lastName: student.lastName,
          classrooms: student.enrollments.map((item) => item.classroom.name).join(", "), createdAt: student.createdAt,
        })),
      };
    }
    case "classrooms": {
      const rows = await database.classroom.findMany({
        include: { enrollments: { where: { endDate: null } } },
        orderBy: [{ academicYear: "desc" }, { name: "asc" }],
      });
      return {
        id: dataset, title: "Grupos", description: "Grupos docentes y tutoría",
        columns: [
          { key: "id", label: "ID", width: 26 }, { key: "name", label: "Grupo", width: 22 },
          { key: "academicYear", label: "Curso académico", width: 18 }, { key: "educationalStage", label: "Etapa", width: 18 },
          { key: "isTutorGroup", label: "Grupo tutor", width: 14 }, { key: "students", label: "Alumnos", width: 12 },
        ],
        rows: rows.map((classroom) => ({
          id: classroom.id, name: classroom.name, academicYear: classroom.academicYear,
          educationalStage: classroom.educationalStage, isTutorGroup: classroom.isTutorGroup,
          students: classroom.enrollments.length,
        })),
      };
    }
    case "teaching": {
      const rows = await database.studentSubjectRecord.findMany({
        include: {
          student: true,
          teachingAssignment: { include: { subject: true, classroom: true } },
          grades: { orderBy: { assessedAt: "asc" } },
        },
        orderBy: { updatedAt: "desc" },
      });
      return {
        id: dataset, title: "Seguimiento académico", description: "Ficha del alumnado por asignatura",
        columns: [
          { key: "student", label: "Alumno", width: 28 }, { key: "subject", label: "Asignatura", width: 22 },
          { key: "classroom", label: "Grupo", width: 18 }, { key: "progress", label: "Progreso", width: 18 },
          { key: "participation", label: "Participación", width: 18 }, { key: "homework", label: "Tareas", width: 18 },
          { key: "averageGrade", label: "Nota ponderada", width: 16 }, { key: "gradeCount", label: "Calificaciones", width: 14 },
          { key: "teacherNotes", label: "Notas docentes", width: 42 }, { key: "supportNotes", label: "Apoyos", width: 42 },
        ],
        rows: rows.map((record) => ({
          student: `${record.student.firstName} ${record.student.lastName}`,
          subject: record.teachingAssignment.subject.name,
          classroom: record.teachingAssignment.classroom.name,
          progress: record.progressStatus,
          participation: record.participationStatus,
          homework: record.homeworkStatus,
          averageGrade: weightedGradeAverage(record.grades),
          gradeCount: record.grades.length,
          teacherNotes: record.teacherNotes,
          supportNotes: record.supportNotes,
        })),
      };
    }
    case "tutorings": {
      const rows = await database.tutoringSession.findMany({
        include: { student: true, agreements: true },
        orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
      });
      return {
        id: dataset, title: "Tutorías", description: "Sesiones y acuerdos tutoriales",
        columns: [
          { key: "student", label: "Alumno", width: 28 }, { key: "scheduledAt", label: "Fecha prevista", width: 19 },
          { key: "status", label: "Estado", width: 16 }, { key: "preparation", label: "Preparación", width: 48 },
          { key: "notes", label: "Notas", width: 48 }, { key: "agreements", label: "Acuerdos", width: 12 },
          { key: "pendingAgreements", label: "Acuerdos pendientes", width: 20 },
        ],
        rows: rows.map((session) => ({
          student: `${session.student.firstName} ${session.student.lastName}`,
          scheduledAt: session.scheduledAt,
          status: session.status,
          preparation: session.preparation,
          notes: session.notes,
          agreements: session.agreements.length,
          pendingAgreements: session.agreements.filter((agreement) => agreement.status === "pending").length,
        })),
      };
    }
    case "planning": {
      const rows = await database.lessonPlan.findMany({
        include: { teachingAssignment: { include: { subject: true, classroom: true } }, activities: true },
        orderBy: [{ date: "desc" }, { startMinute: "asc" }],
      });
      return {
        id: dataset, title: "Planificación", description: "Sesiones de clase planificadas",
        columns: [
          { key: "date", label: "Fecha", width: 15 }, { key: "start", label: "Inicio", width: 10 },
          { key: "end", label: "Fin", width: 10 }, { key: "subject", label: "Asignatura", width: 22 },
          { key: "classroom", label: "Grupo", width: 18 }, { key: "title", label: "Sesión", width: 34 },
          { key: "status", label: "Estado", width: 16 }, { key: "activities", label: "Actividades", width: 12 },
          { key: "homework", label: "Tareas", width: 36 }, { key: "notes", label: "Notas posteriores", width: 40 },
        ],
        rows: rows.map((lesson) => ({
          date: lesson.date,
          start: minuteLabel(lesson.startMinute),
          end: minuteLabel(lesson.endMinute),
          subject: lesson.teachingAssignment.subject.name,
          classroom: lesson.teachingAssignment.classroom.name,
          title: lesson.title,
          status: lesson.status,
          activities: lesson.activities.length,
          homework: lesson.homework,
          notes: lesson.postLessonNotes,
        })),
      };
    }
    case "observations": {
      const rows = await database.studentObservation.findMany({
        include: { student: true },
        orderBy: { observedAt: "desc" },
      });
      return {
        id: dataset, title: "Observaciones", description: "Histórico de observaciones",
        columns: [
          { key: "student", label: "Alumno", width: 28 }, { key: "observedAt", label: "Fecha", width: 19 },
          { key: "category", label: "Categoría", width: 18 }, { key: "source", label: "Origen", width: 16 },
          { key: "status", label: "Confirmación", width: 18 }, { key: "content", label: "Observación", width: 60 },
        ],
        rows: rows.map((observation) => ({
          student: `${observation.student.firstName} ${observation.student.lastName}`,
          observedAt: observation.observedAt,
          category: observation.category,
          source: observation.source,
          status: observation.confirmationStatus,
          content: observation.content,
        })),
      };
    }
    case "teacherFeedback": {
      const rows = await database.teacherFeedback.findMany({
        include: { student: true, tutoringSession: true },
        orderBy: { receivedAt: "desc" },
      });
      return {
        id: dataset, title: "Comentarios docentes", description: "Comentarios del profesorado preparados para tutoría",
        columns: [
          { key: "student", label: "Alumno", width: 28 }, { key: "receivedAt", label: "Fecha recibida", width: 19 },
          { key: "teacher", label: "Profesor/a", width: 24 }, { key: "subject", label: "Asignatura o contexto", width: 24 },
          { key: "originalComment", label: "Comentario original", width: 60 }, { key: "familyVersion", label: "Versión para la familia", width: 60 },
          { key: "status", label: "Estado", width: 18 }, { key: "tutoringSession", label: "Tutoría asociada", width: 24 },
        ],
        rows: rows.map((feedback) => ({
          student: `${feedback.student.firstName} ${feedback.student.lastName}`,
          receivedAt: feedback.receivedAt,
          teacher: feedback.teacherName,
          subject: feedback.subject,
          originalComment: feedback.originalComment,
          familyVersion: feedback.familyVersion,
          status: feedback.familyVersionStatus,
          tutoringSession: feedback.tutoringSessionId,
        })),
      };
    }
    case "agentActivity": {
      const rows = await database.agentExecution.findMany({ orderBy: { startedAt: "desc" } });
      return {
        id: dataset, title: "Actividad de agentes", description: "Ejecuciones de agentes locales",
        columns: [
          { key: "id", label: "ID", width: 26 }, { key: "agentId", label: "Agente", width: 24 },
          { key: "operation", label: "Operación", width: 28 }, { key: "status", label: "Estado", width: 14 },
          { key: "startedAt", label: "Inicio", width: 19 }, { key: "finishedAt", label: "Fin", width: 19 },
          { key: "durationMs", label: "Duración (ms)", width: 15 }, { key: "error", label: "Error", width: 48 },
        ],
        rows: rows.map((execution) => ({
          id: execution.id, agentId: execution.agentId, operation: execution.operation, status: execution.status,
          startedAt: execution.startedAt, finishedAt: execution.finishedAt,
          durationMs: execution.finishedAt ? execution.finishedAt.getTime() - execution.startedAt.getTime() : null,
          error: execution.error,
        })),
      };
    }
    case "cloudAiUsage": {
      const rows = await database.cloudAiTrace.findMany({ orderBy: { createdAt: "desc" } });
      return {
        id: dataset, title: "Consumo de IA", description: "Metadatos de uso sin contenido de peticiones",
        columns: [
          { key: "id", label: "ID", width: 26 }, { key: "agentId", label: "Agente", width: 24 },
          { key: "operation", label: "Operación", width: 28 }, { key: "model", label: "Modelo", width: 24 },
          { key: "status", label: "Estado", width: 14 }, { key: "inputTokens", label: "Tokens entrada", width: 16 },
          { key: "outputTokens", label: "Tokens salida", width: 16 }, { key: "totalTokens", label: "Tokens totales", width: 16 },
          { key: "durationMs", label: "Duración (ms)", width: 15 }, { key: "createdAt", label: "Fecha", width: 19 },
        ],
        rows: rows.map((trace) => ({
          id: trace.id, agentId: trace.agentId, operation: trace.operation, model: trace.model, status: trace.status,
          inputTokens: trace.inputTokens, outputTokens: trace.outputTokens, totalTokens: trace.totalTokens,
          durationMs: trace.durationMs, createdAt: trace.createdAt,
        })),
      };
    }
  }
}

function minuteLabel(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
