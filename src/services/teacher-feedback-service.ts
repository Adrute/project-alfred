import { randomUUID } from "node:crypto";
import { getConnectedLlmProvider } from "@/ai/providers/provider-factory";
import {
  confirmTeacherFeedbackSchema,
  familyVersionSchema,
  teacherFeedbackInputSchema,
  type ConfirmTeacherFeedbackInput,
  type TeacherFeedbackInput,
} from "@/domain/teacher-feedback";
import { database } from "@/lib/database";
import { createStudentPseudonymizer } from "@/services/student-pseudonymization-service";

async function proposeFamilyVersion(input: TeacherFeedbackInput) {
  const provider = await getConnectedLlmProvider({
    operation: "rewrite_teacher_feedback_for_family",
    agentId: "tutoring-agent",
  });
  if (!provider) {
    return {
      familyVersion: input.originalComment,
      source: "Texto original · revisa la redacción antes de confirmarla",
    };
  }

  const pseudonymizer = await createStudentPseudonymizer(`teacher-feedback:${randomUUID()}`);
  const prompt = [
    "Reescribe el comentario docente para que una tutora pueda leerlo directamente a la familia.",
    "Mantén exactamente los hechos aportados. No añadas diagnósticos, causas, intenciones, recomendaciones ni información nueva.",
    "Usa un tono claro, respetuoso, concreto y profesional en español. Evita etiquetas sobre el alumno.",
    input.subject ? `Asignatura o contexto: ${input.subject}.` : "No se ha indicado asignatura.",
    `Comentario original: ${input.originalComment}`,
  ].join("\n");
  const proposal = await provider.generateStructured(
    pseudonymizer.pseudonymizeText(prompt),
    familyVersionSchema,
    { system: "Eres un asistente de tutoría prudente. Reformulas sin inventar, diagnosticar ni suavizar hasta cambiar el significado." },
  );
  return {
    familyVersion: pseudonymizer.depseudonymize(proposal).familyVersion,
    source: "Propuesta de Alfred con IA · pendiente de revisión docente",
  };
}

export async function createTeacherFeedback(rawInput: TeacherFeedbackInput) {
  const input = teacherFeedbackInputSchema.parse(rawInput);
  const student = await database.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw new Error("No se encontró el alumno.");

  let proposal: { familyVersion: string; source: string };
  try {
    proposal = await proposeFamilyVersion(input);
  } catch {
    proposal = {
      familyVersion: input.originalComment,
      source: "Texto original · Alfred no pudo generar otra redacción",
    };
  }

  return database.teacherFeedback.create({
    data: {
      studentId: input.studentId,
      teacherName: input.teacherName,
      subject: input.subject,
      originalComment: input.originalComment,
      familyVersion: proposal.familyVersion,
      familyVersionSource: proposal.source,
      receivedAt: input.receivedAt ? new Date(`${input.receivedAt}T12:00:00`) : new Date(),
      familyVersionStatus: "proposed",
    },
  });
}

export async function confirmTeacherFeedback(rawInput: ConfirmTeacherFeedbackInput) {
  const input = confirmTeacherFeedbackSchema.parse(rawInput);
  const feedback = await database.teacherFeedback.findUnique({ where: { id: input.feedbackId } });
  if (!feedback) throw new Error("No se encontró el comentario docente.");

  return database.$transaction(async (transaction) => {
    const now = new Date();
    const scheduledSession = await transaction.tutoringSession.findFirst({
      where: {
        studentId: feedback.studentId,
        status: { in: ["draft", "prepared"] },
        scheduledAt: { gte: now },
      },
      orderBy: { scheduledAt: "asc" },
    });
    const unscheduledSession = scheduledSession ?? await transaction.tutoringSession.findFirst({
      where: { studentId: feedback.studentId, status: { in: ["draft", "prepared"] }, scheduledAt: null },
      orderBy: { createdAt: "desc" },
    });
    const tutoringSession = unscheduledSession ?? await transaction.tutoringSession.create({
      data: { studentId: feedback.studentId, status: "draft" },
    });

    const saved = await transaction.teacherFeedback.update({
      where: { id: feedback.id },
      data: {
        familyVersion: input.familyVersion,
        familyVersionStatus: "confirmed",
        tutoringSessionId: tutoringSession.id,
      },
    });
    return { feedback: saved, tutoringSession };
  });
}
