import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getConnectedLlmProvider } from "@/ai/providers/provider-factory";
import { getStudentProfile } from "./student-service";
import { createStudentPseudonymizer } from "./student-pseudonymization-service";

const tutoringDraftSchema = z.object({
  strengths: z.array(z.string()).max(5),
  followUp: z.array(z.string()).max(5),
  questions: z.array(z.string()).min(2).max(6),
  possibleAgreements: z.array(z.string()).min(1).max(5),
  nextSteps: z.array(z.string()).min(1).max(5),
});

const bullets = (items: string[]) => items.length ? items.map((item) => `- ${item}`).join("\n") : "- Sin datos registrados.";

function deterministicDraft(facts: Array<{ content: string }>) {
  return {
    strengths: facts.filter((item) => /particip|bien|mejor|trabaj/i.test(item.content)).map((item) => item.content),
    followUp: facts.filter((item) => /distra|neces|dificult/i.test(item.content)).map((item) => item.content),
    questions: ["¿Cómo percibe la familia su experiencia reciente en clase?", "¿Qué apoyos funcionan bien en casa?"],
    possibleAgreements: ["Acordar una pauta concreta y revisable entre familia, alumno y profesora."],
    nextSteps: ["Revisar el acuerdo en la próxima tutoría."],
  };
}

export async function prepareTutoring(studentId: string) {
  const student = await getStudentProfile(studentId);
  if (!student) throw new Error("No se encontró el alumno.");
  const facts = student.observations.map((item) => ({
    date: item.observedAt.toISOString().slice(0, 10), category: item.category, content: item.content,
  }));
  let generated: z.infer<typeof tutoringDraftSchema>;
  let source = "Plantilla determinista (sin hechos que contextualizar)";
  if (!facts.length) {
    generated = deterministicDraft(facts);
  } else {
    const provider = await getConnectedLlmProvider({ operation: "prepare_tutoring", agentId: "tutoring-agent" });
    source = "ChatGPT (nombre seudonimizado localmente)";
    try {
      if (!provider) throw new Error("ChatGPT no está conectado.");
      const pseudonymizer = await createStudentPseudonymizer(`tutoring:${randomUUID()}`);
      const classroom = student.enrollments[0]?.classroom;
      const cloudResult = await provider.generateStructured(
        pseudonymizer.pseudonymizeText(`Prepara una tutoría familiar para ${student.firstName} ${student.lastName}, alumno de ${classroom?.name ?? "un grupo no especificado"} en la etapa ${classroom?.educationalStage ?? "no especificada"}. Hechos registrados: ${JSON.stringify(facts)}. No inventes hechos, problemas, preocupaciones, asignaturas, recursos, etapas educativas ni circunstancias familiares. Las preguntas, acuerdos y pasos son propuestas, no hechos. Responde en español.`),
        tutoringDraftSchema,
        { system: "Eres un asistente docente prudente de un centro escolar. Solo puedes tratar como hechos los registros suministrados y nunca debes asumir asignaturas, problemas o etapas no indicadas." },
      );
      generated = pseudonymizer.depseudonymize(cloudResult);
    } catch {
      source = "Plantilla determinista (ChatGPT no disponible)";
      generated = deterministicDraft(facts);
    }
  }
  const registered = facts.length
    ? facts.map((item) => `- ${item.date} · ${item.content}`).join("\n")
    : "- No hay observaciones registradas todavía.";
  const preparation = [
    `TUTORÍA · ${student.firstName} ${student.lastName}`,
    `Grupo: ${student.enrollments[0]?.classroom.name ?? "Sin grupo activo"}`,
    `Preparación: ${source}`,
    "", "HECHOS REGISTRADOS", registered,
    "", "FORTALEZAS OBSERVADAS", bullets(generated.strengths),
    "", "ASPECTOS DE SEGUIMIENTO", bullets(generated.followUp),
    "", "PREGUNTAS PROPUESTAS PARA LA FAMILIA", bullets(generated.questions),
    "", "POSIBLES ACUERDOS (requieren decisión docente)", bullets(generated.possibleAgreements),
    "", "PRÓXIMOS PASOS PROPUESTOS", bullets(generated.nextSteps),
  ].join("\n");
  return { student, preparation, source };
}
