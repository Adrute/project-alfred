import { z } from "zod";
import { getConnectedLlmProvider } from "@/ai/providers/provider-factory";
import type { ChatPageContext } from "@/domain/chat";
import { localDateKey, minuteLabel, mondayOfWeek } from "@/domain/planning";
import { listClassrooms } from "./classroom-service";
import { getCurriculumOverview, getWeekPlan } from "./planning-service";
import { getRecentObservations, getStudentProfile, listStudents, resolveStudents, resolveStudentsInConversation } from "./student-service";
import { getAgentDashboard } from "./agent-admin-service";
import { getDatabaseOverview } from "./database-admin-service";
import { createStudentPseudonymizer } from "./student-pseudonymization-service";

export const assistantToolDecisionSchema = z.object({
  tool: z.enum([
    "count_students",
    "list_students",
    "student_profile",
    "student_observations",
    "list_classrooms",
    "planning_overview",
    "curriculum_overview",
    "create_classroom",
    "create_student",
    "agent_dashboard",
    "control_agent",
    "database_overview",
    "general_conversation",
  ]),
  studentQuery: z.string().max(120),
  responseStyle: z.enum(["brief", "detailed", "table"]),
  nameStartsWith: z.string().max(20).default(""),
  nameEndsWith: z.string().max(20).default(""),
  nameContains: z.string().max(80).default(""),
  classroomQuery: z.string().max(80).default(""),
  observationQuery: z.string().max(120).default(""),
  observationMode: z.enum(["any", "with", "without"]).default("any"),
  limit: z.number().int().min(1).max(100).default(50),
  classroomName: z.string().max(80).default(""),
  academicYear: z.string().max(20).default(""),
  educationalStage: z.string().max(80).default(""),
  studentFirstName: z.string().max(80).default(""),
  studentLastName: z.string().max(120).default(""),
  agentQuery: z.string().max(120).default(""),
  agentAction: z.enum(["none", "start", "stop", "restart"]).default("none"),
});

export type AssistantToolDecision = z.infer<typeof assistantToolDecisionSchema>;
type ConversationTurn = { role: string; content: string };

const toolCatalog = `
- count_students: contar el alumnado registrado o responder si hay alumnos.
- list_students: listar o filtrar alumnos. Extrae literalmente los filtros solicitados en nameStartsWith, nameEndsWith, nameContains, classroomQuery y observationQuery. Usa observationMode=with/without si piden alumnos con/sin observaciones. Usa responseStyle=table si piden tabla o incluir observaciones.
- student_profile: consultar quién es un alumno concreto o toda su ficha registrada. Pon su nombre en studentQuery.
- student_observations: consultar las observaciones de un alumno concreto o las observaciones generales. Pon el nombre en studentQuery si existe.
- list_classrooms: listar grupos/clases, matrículas y datos básicos.
- planning_overview: consultar agenda, clases o planificación de la semana actual.
- curriculum_overview: consultar asignaturas, unidades, contenidos o progreso curricular.
- create_classroom: crear o dar de alta una clase/grupo. Extrae classroomName, academicYear y educationalStage. Si falta algo, déjalo vacío; nunca lo inventes.
- create_student: crear o matricular un alumno. Extrae studentFirstName, studentLastName y classroomQuery. Si falta algo, déjalo vacío.
- agent_dashboard: consultar estado, actividad o estadísticas de los agentes.
- control_agent: iniciar, detener o reiniciar un agente. Pon el agente en agentQuery y la acción en agentAction.
- database_overview: consultar tablas, recuentos o estado de la base de datos local. No sirve para borrar.
- general_conversation: conversación que no necesita consultar datos estructurados.
`;

function transcript(history: ConversationTurn[]) {
  return history.slice(-12).map((item) => `${item.role === "user" ? "Profesora" : "Alfred"}: ${item.content}`).join("\n");
}

export function fallbackToolDecision(message: string, history: ConversationTurn[] = []): AssistantToolDecision {
  const lower = message.toLocaleLowerCase("es");
  const context = `${transcript(history)}\n${message}`;
  const studentQuery = context.slice(-500);
  const previousAssistant = [...history].reverse().find((turn) => turn.role === "assistant")?.content ?? "";
  if (isStudentCollectionFollowUp(message) && previousStudentFilterRequest(history)) {
    return withDefaultFilters({
      tool: /cu[aá]ntos?/i.test(message) ? "count_students" : "list_students",
      studentQuery: "",
      responseStyle: /tabla|columnas?/i.test(message) ? "table" : "detailed",
    });
  }
  const classCreation = /\b(?:crear|crea|añadir|añade|agregar|agrega|dar de alta)\b[\s\S]{0,45}\b(?:clase|grupo)\b|\b(?:clase|grupo)\s+nuev[oa]\b/i.test(message)
    || /Para crear (?:la clase|el grupo).*nombre.*curso acad[eé]mico.*etapa/i.test(previousAssistant);
  if (classCreation) {
    const source = `${previousAssistant}\n${message}`;
    const commonName = source.match(/\b(\d{1,2}\s*(?:[.ºº°]|o)?\s*(?:ESO|Primaria|Bachillerato|Infantil|FP)\s*[A-Z])\b/i)?.[1] ?? "";
    const named = message.match(/(?:se\s+llama|nombre\s*(?:es|:)?)\s+["“]?([^,.;\n"”]+)/i)?.[1]?.trim() ?? "";
    const academicYear = message.match(/\b(20\d{2})\s*[-–/]\s*(20\d{2})\b/)?.slice(1).join("-") ?? "";
    const educationalStage = message.match(/\b(Infantil|Primaria|ESO|Bachillerato|FP)\b/i)?.[1] ?? (commonName.match(/ESO|Primaria|Bachillerato|Infantil|FP/i)?.[0] ?? "");
    return withDefaultFilters({ tool: "create_classroom", studentQuery: "", responseStyle: "brief", classroomName: named || commonName, academicYear, educationalStage });
  }
  const studentCreation = /\b(?:crear|crea|añadir|añade|agregar|agrega|matricular|matricula|dar de alta)\b[\s\S]{0,45}\b(?:alumn[oa]|estudiante)\b/i.test(message)
    || /Para crear el alumno necesito nombre, apellidos y una clase existente/i.test(previousAssistant);
  if (studentCreation) {
    const named = message.match(/(?:añade|agrega|matricula|alta)\s+(?:al\s+alumn[oa]\s+|a\s+)?([\p{L}'’-]+)\s+([\p{L}'’ -]+?)\s+(?:en|a)\s+(\d{1,2}\s*(?:[.ºº°]|o)?\s*(?:ESO|Primaria|Bachillerato|Infantil|FP)\s*[A-Z])/iu)
      ?? message.match(/^\s*([\p{L}'’-]+)\s+([\p{L}'’ -]+?)\s+(?:en|a)\s+(\d{1,2}\s*(?:[.ºº°]|o)?\s*(?:ESO|Primaria|Bachillerato|Infantil|FP)\s*[A-Z])/iu);
    return withDefaultFilters({
      tool: "create_student", studentQuery: "", responseStyle: "brief",
      studentFirstName: named?.[1]?.trim() ?? "",
      studentLastName: named?.[2]?.trim() ?? "",
      classroomQuery: named?.[3]?.trim() ?? "",
    });
  }
  if (/\b(?:estado|estad[ií]sticas?|actividad)\b[\s\S]{0,40}\bagentes?\b|\bagentes?\b[\s\S]{0,40}\b(?:estado|estad[ií]sticas?|actividad)\b/i.test(lower)) {
    return withDefaultFilters({ tool: "agent_dashboard", studentQuery: "", responseStyle: "detailed" });
  }
  const agentControl = lower.match(/\b(inicia|arranca|det[eé]n|para|reinicia)\b[\s\S]{0,30}\bagente\s+([a-z][\w-]*)/i);
  if (agentControl) {
    const action = /det[eé]n|para/.test(agentControl[1]) ? "stop" as const : /reinicia/.test(agentControl[1]) ? "restart" as const : "start" as const;
    return withDefaultFilters({ tool: "control_agent", studentQuery: "", responseStyle: "brief", agentQuery: agentControl[2], agentAction: action });
  }
  if (/base de datos|sqlite|tablas? de (?:la )?base/i.test(lower)) return withDefaultFilters({ tool: "database_overview", studentQuery: "", responseStyle: "detailed" });
  if (/cu[aá]ntos?.*(?:alumnos?|estudiantes?)|(?:tengo|hay).*(?:alumnos?|estudiantes?)/i.test(lower)) {
    return withDefaultFilters({ tool: "count_students", studentQuery: "", responseStyle: "brief" });
  }
  if (/(?:tabla|lista|nombres?).*(?:alumnos?|estudiantes?)|(?:alumnos?|estudiantes?).*(?:tabla|lista|nombres?|registrad)/i.test(lower)) {
    return withDefaultFilters({ tool: "list_students", studentQuery: "", responseStyle: /tabla|observaciones?/i.test(lower) ? "table" : "detailed" });
  }
  if (/observaciones?|anotaciones?|incidencias?/i.test(lower)) {
    return withDefaultFilters({ tool: "student_observations", studentQuery, responseStyle: /tabla/i.test(lower) ? "table" : "detailed" });
  }
  if (/qui[eé]n es|qu[eé] sabes de|datos? (?:de|sobre)|informaci[oó]n (?:de|sobre)|conoces? a|h[aá]blame de|cu[eé]ntame (?:de|sobre)/i.test(lower)) {
    return withDefaultFilters({ tool: "student_profile", studentQuery, responseStyle: "detailed" });
  }
  if (/\b(?:en|a)\s+qu[eé]\s+(?:grupo|clase)\s+(?:est[aá]|pertenece)|\bcu[aá]l\s+es\s+su\s+(?:grupo|clase)\b/i.test(lower)) {
    return withDefaultFilters({ tool: "student_profile", studentQuery, responseStyle: "detailed" });
  }
  if (/grupos?|clases? registradas?|matriculad/i.test(lower)) {
    return withDefaultFilters({ tool: "list_classrooms", studentQuery: "", responseStyle: "detailed" });
  }
  if (/curr[ií]cul|asignaturas?|unidades?|contenidos?|progreso acad[eé]mico/i.test(lower)) {
    return withDefaultFilters({ tool: "curriculum_overview", studentQuery: "", responseStyle: "detailed" });
  }
  if (/agenda|horario|planificaci[oó]n|clases? de esta semana/i.test(lower)) {
    return withDefaultFilters({ tool: "planning_overview", studentQuery: "", responseStyle: "detailed" });
  }
  return withDefaultFilters({ tool: "general_conversation", studentQuery: "", responseStyle: "brief" });
}

function withDefaultFilters(base: Pick<AssistantToolDecision, "tool" | "studentQuery" | "responseStyle"> & Partial<AssistantToolDecision>): AssistantToolDecision {
  return {
    nameStartsWith: "", nameEndsWith: "", nameContains: "", classroomQuery: "", observationQuery: "", observationMode: "any", limit: 50,
    classroomName: "", academicYear: "", educationalStage: "", studentFirstName: "", studentLastName: "", agentQuery: "", agentAction: "none",
    ...base,
  };
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();

function hasStudentFilters(message: string) {
  const filters = inferStudentListFilters(message);
  return Boolean(
    filters.nameStartsWith
    || filters.nameEndsWith
    || filters.nameContains
    || filters.classroomQuery
    || filters.observationMode !== "any",
  );
}

export function isStudentCollectionFollowUp(message: string) {
  const text = normalize(message).replace(/^[¿?¡!\s]+|[¿?¡!\s]+$/g, "");
  return /^(?:y\s+)?(?:dime\s+)?(?:quienes|cuales)(?:\s+son)?$/.test(text)
    || /^(?:y\s+)?cuantos(?:\s+son|\s+hay)?$/.test(text)
    || /^(?:dime|lista|muestra|ensen?a)(?:me)?los$/.test(text)
    || /^(?:y\s+)?(?:dime\s+)?(?:(?:sus|los)\s+)?nombres$/.test(text)
    || /^(?:hazme|ponlos?\s+en)\s+(?:una\s+)?tabla$/.test(text);
}

export function previousStudentFilterRequest(history: ConversationTurn[]) {
  const userTurns = history.filter((turn) => turn.role === "user").slice(-6).reverse();
  for (const turn of userTurns) {
    if (hasStudentFilters(turn.content)) return turn.content;
    if (!isStudentCollectionFollowUp(turn.content)) break;
  }
  return "";
}

export function inferStudentListFilters(message: string) {
  const normalized = normalize(message);
  const starts = normalized.match(/(?:empie(?:cen|zan|za)|comien(?:cen|zan|za)|inicia(?:n)?)(?:\s+por)?(?:\s+la)?\s+letra\s+([a-zñ])\b/)
    ?? normalized.match(/(?:empie(?:cen|zan|za)|comien(?:cen|zan|za)|inicia(?:n)?)(?:\s+por)?\s+([a-zñ])\b/);
  const ends = normalized.match(/(?:termin(?:en|an|a)|acab(?:en|an|a))(?:\s+en|\s+por)?(?:\s+la)?\s+letra\s+([a-zñ])\b/)
    ?? normalized.match(/(?:termin(?:en|an|a)|acab(?:en|an|a))(?:\s+en|\s+por)?\s+([a-zñ])\b/);
  const contains = normalized.match(/(?:nombre|nombres)\s+(?:que\s+)?cont(?:enga|engan|iene|ienen)\s+(?:la\s+)?(?:letra\s+)?([a-zñ]+)/);
  const classroom = normalized.match(/\b(\d+\s*(?:º|o)?\s*(?:eso|primaria|bachillerato)\s*[a-z]?)\b/);
  const observationMode = /sin observaciones?/.test(normalized) ? "without" as const
    : /con observaciones?/.test(normalized) ? "with" as const
      : "any" as const;
  return {
    nameStartsWith: starts?.[1] ?? "",
    nameEndsWith: ends?.[1] ?? "",
    nameContains: contains?.[1] ?? "",
    classroomQuery: classroom?.[1] ?? "",
    observationMode,
  };
}

async function selectFilteredStudents(decision: AssistantToolDecision, message: string, history: ConversationTurn[]) {
  const inheritedRequest = isStudentCollectionFollowUp(message) ? previousStudentFilterRequest(history) : "";
  const filterMessage = inheritedRequest ? `${inheritedRequest}\n${message}` : message;
  const inferred = inferStudentListFilters(filterMessage);
  const nameStartsWith = normalize(inferred.nameStartsWith || decision.nameStartsWith);
  const nameEndsWith = normalize(inferred.nameEndsWith || decision.nameEndsWith);
  const nameContains = normalize(inferred.nameContains || decision.nameContains);
  const classroomQuery = normalize(inferred.classroomQuery || decision.classroomQuery);
  const observationQuery = normalize(decision.observationQuery);
  const observationMode = inferred.observationMode;
  const filtered = Boolean(nameStartsWith || nameEndsWith || nameContains || classroomQuery || observationQuery || observationMode !== "any");
  const allStudents = await listStudents();
  const students = allStudents.filter((student) => {
    const firstName = normalize(student.firstName);
    const fullName = normalize(`${student.firstName} ${student.lastName}`);
    const classroom = normalize(student.enrollments[0]?.classroom.name ?? "");
    const observations = student.observations.map((item) => normalize(item.content));
    return (!nameStartsWith || firstName.startsWith(nameStartsWith))
      && (!nameEndsWith || firstName.endsWith(nameEndsWith))
      && (!nameContains || fullName.includes(nameContains))
      && (!classroomQuery || classroom.replace(/[º.]/g, "").includes(classroomQuery.replace(/[º.]/g, "")))
      && (!observationQuery || observations.some((item) => item.includes(observationQuery)))
      && (observationMode === "any" || (observationMode === "with" ? observations.length > 0 : observations.length === 0));
  }).slice(0, decision.limit);
  return { students, filtered };
}

export async function selectAssistantTool(message: string, history: ConversationTurn[], pageContext?: ChatPageContext, conversationId = "tool-selection"): Promise<AssistantToolDecision> {
  const deterministic = fallbackToolDecision(message, history);
  // Clear, testable intents are resolved deterministically. The LLM is reserved for
  // natural-language requests that do not match a known command pattern.
  if (deterministic.tool !== "general_conversation") return deterministic;
  const provider = await getConnectedLlmProvider({ conversationId, operation: "select_assistant_tool", agentId: "alfred-orchestrator" });
  try {
    if (!provider) return deterministic;
    const pseudonymizer = await createStudentPseudonymizer(conversationId);
    const cloudDecision = await provider.generateStructured(
      pseudonymizer.pseudonymizeText(`Historial exclusivo de este chat:\n${transcript(history) || "(sin mensajes anteriores)"}\n\nPantalla visible ahora: ${pageContext ? `${pageContext.label}: ${pageContext.summary}` : "(sin contexto de pantalla)"}.\n\nSolicitud actual: ${message}\n\nHerramientas disponibles:${toolCatalog}\nElige exactamente una herramienta según la intención de la solicitud actual. La pantalla visible aporta contexto, pero nunca convierte por sí sola una petición administrativa en una operación sobre el alumno visible. Para cualquier pregunta sobre datos docentes guardados debes elegir una herramienta de consulta, aunque los datos no aparezcan en el historial. Usa studentQuery solo para la referencia seudonimizada del alumno; déjalo vacío en los demás casos. En operaciones de escritura, extrae solo datos explícitos del mensaje o del diálogo actual y deja vacíos los campos ausentes.`),
      assistantToolDecisionSchema,
      {
        temperature: 0,
        system: "Eres el orquestador local de Alfred. Clasifica la intención y selecciona una herramienta segura. No respondas la pregunta y no inventes datos. Devuelve únicamente la decisión estructurada solicitada.",
      },
    );
    const modelDecision = pseudonymizer.depseudonymize(cloudDecision);
    // A model may never turn an ambiguous sentence into a mutation. Those require
    // an explicit deterministic match above and still go through PendingAction.
    if (["create_classroom", "create_student", "control_agent"].includes(modelDecision.tool)) {
      return deterministic;
    }
    return modelDecision;
  } catch {
    return fallbackToolDecision(message, history);
  }
}

export function agentForAssistantTool(tool: AssistantToolDecision["tool"]) {
  if (tool === "count_students" || tool === "list_students") return "student-agent";
  if (tool === "student_profile" || tool === "student_observations") return "memory-agent";
  if (tool === "list_classrooms") return "classroom-agent";
  if (tool === "planning_overview") return "planning-agent";
  if (tool === "curriculum_overview") return "curriculum-agent";
  if (tool === "create_classroom" || tool === "create_student") return tool === "create_student" ? "student-agent" : "classroom-agent";
  return "alfred-orchestrator";
}

function observationsText(observations: Array<{ observedAt: Date; content: string }>) {
  return observations.length
    ? observations.map((item) => `- ${item.observedAt.toLocaleDateString("es-ES")}: ${item.content}`).join("\n")
    : "- No hay observaciones registradas.";
}

export async function executeAssistantTool(decision: AssistantToolDecision, message: string, history: ConversationTurn[]) {
  if (decision.tool === "count_students") {
    const { students, filtered } = await selectFilteredStudents(decision, message, history);
    const groups = new Set(students.flatMap((student) => student.enrollments.map((item) => item.classroom.name)));
    const groupText = groups.size ? ` en ${groups.size} ${groups.size === 1 ? "grupo activo" : "grupos activos"}` : "";
    return filtered
      ? `Hay ${students.length} ${students.length === 1 ? "alumno que cumple" : "alumnos que cumplen"} los filtros${groupText}.`
      : `Sí. Hay ${students.length} alumnos registrados${groupText}.`;
  }

  if (decision.tool === "list_students") {
    const { students, filtered } = await selectFilteredStudents(decision, message, history);
    if (!students.length) return "No he encontrado alumnos que cumplan esos filtros.";
    if (/tabla|observaciones?/i.test(message)) {
      return [
        `${filtered ? "He encontrado" : "Hay"} ${students.length} ${students.length === 1 ? "alumno" : "alumnos"}${filtered ? ` que ${students.length === 1 ? "cumple" : "cumplen"} los filtros` : " registrados"}:`,
        "",
        "Alumno | Grupo | Observaciones",
        "--- | --- | ---",
        ...students.map((student) => {
          const notes = student.observations.length ? student.observations.map((item) => item.content).join("; ") : "Sin observaciones";
          return `${student.firstName} ${student.lastName} | ${student.enrollments[0]?.classroom.name ?? "Sin grupo"} | ${notes}`;
        }),
      ].join("\n");
    }
    return `${filtered ? "He encontrado" : "Hay"} ${students.length} ${students.length === 1 ? "alumno" : "alumnos"}${filtered ? ` que ${students.length === 1 ? "cumple" : "cumplen"} los filtros` : " registrados"}:\n${students.map((student) => `- ${student.firstName} ${student.lastName} · ${student.enrollments[0]?.classroom.name ?? "Sin grupo"}`).join("\n")}`;
  }

  if (decision.tool === "student_profile" || decision.tool === "student_observations") {
    const query = decision.studentQuery.trim();
    let matches = query ? await resolveStudents(query) : [];
    if (!matches.length) matches = await resolveStudentsInConversation(message, history);
    if (decision.tool === "student_observations" && !matches.length && !decision.studentQuery.trim()) {
      const observations = await getRecentObservations(3650);
      return observations.length
        ? `Hay ${observations.length} observaciones confirmadas:\n${observations.map((item) => `- ${item.student.firstName} ${item.student.lastName}: ${item.content}`).join("\n")}`
        : "No hay observaciones confirmadas registradas.";
    }
    if (matches.length !== 1) {
      return matches.length > 1
        ? `He encontrado varios alumnos posibles: ${matches.map((item) => `${item.firstName} ${item.lastName}`).join(", ")}. Indícame nombre y apellido.`
        : "No encuentro un alumno que coincida con ese nombre. Puedes pedirme la lista de alumnos registrados.";
    }
    const profile = await getStudentProfile(matches[0].id);
    if (!profile) return "No se encontró el alumno solicitado.";
    if (decision.tool === "student_observations") {
      return `Observaciones confirmadas de ${profile.firstName} ${profile.lastName}:\n${observationsText(profile.observations)}`;
    }
    const relationships = [
      ...profile.relationshipsAsA.map((item) => `- ${item.studentB.firstName} ${item.studentB.lastName}: ${item.description}`),
      ...profile.relationshipsAsB.map((item) => `- ${item.studentA.firstName} ${item.studentA.lastName}: ${item.description}`),
    ];
    const academic = profile.subjectRecords.map((record) => `- ${record.teachingAssignment.subject.name} · ${record.teachingAssignment.classroom.name}: ${record.progressStatus}; ${record.grades.length ? record.grades.map((grade) => `${grade.title} ${grade.score}/${grade.maxScore}`).join(", ") : "sin calificaciones"}`);
    return [
      `${profile.firstName} ${profile.lastName} pertenece a ${profile.enrollments[0]?.classroom.name ?? "un grupo no especificado"}.`,
      "", "Observaciones confirmadas:", observationsText(profile.observations),
      "", "Relaciones contextuales activas:", relationships.length ? relationships.join("\n") : "- Ninguna registrada.",
      "", "Seguimiento académico por asignatura:", academic.length ? academic.join("\n") : "- Sin registros académicos.",
    ].join("\n");
  }

  if (decision.tool === "list_classrooms") {
    const classrooms = await listClassrooms();
    return classrooms.length
      ? `Hay ${classrooms.length} grupos registrados:\n${classrooms.map((item) => `- ${item.name} (${item.educationalStage}, ${item.academicYear}): ${item.enrollments.length} alumnos`).join("\n")}`
      : "No hay grupos registrados.";
  }

  if (decision.tool === "planning_overview") {
    const week = await getWeekPlan(mondayOfWeek(localDateKey()));
    return week.lessons.length
      ? `Esta semana hay ${week.lessons.length} sesiones:\n${week.lessons.map((item) => `- ${item.date.toLocaleDateString("es-ES")}, ${minuteLabel(item.startMinute)} · ${item.teachingAssignment.subject.name} con ${item.teachingAssignment.classroom.name} · ${item.status}`).join("\n")}`
      : "No hay sesiones registradas para esta semana.";
  }

  if (decision.tool === "curriculum_overview") {
    const assignments = await getCurriculumOverview();
    return assignments.length
      ? `Hay ${assignments.length} asignaciones docentes activas:\n${assignments.map((item) => {
          const completed = item.teachingUnits.flatMap((unit) => unit.contents).filter((content) => content.status === "completed").length;
          const total = item.teachingUnits.flatMap((unit) => unit.contents).length;
          return `- ${item.subject.name} · ${item.classroom.name}: ${item.teachingUnits.length} unidades, ${completed}/${total} contenidos completados`;
        }).join("\n")}`
      : "No hay currículo registrado.";
  }

  if (decision.tool === "agent_dashboard") {
    const agents = await getAgentDashboard();
    return `Estado de los agentes:\n${agents.map((agent) => `- ${agent.name}: ${agent.runtime?.status === "running" ? "activo" : "detenido"} · ${agent.statistics.totalExecutions} ejecuciones · ${agent.statistics.successRate}% de éxito`).join("\n")}`;
  }

  if (decision.tool === "database_overview") {
    const overview = await getDatabaseOverview("students");
    return `La base de datos es ${overview.engine} y contiene ${overview.totalRecords} registros en ${overview.tables.length} tablas administradas.\n${overview.tables.filter((table) => table.count > 0).map((table) => `- ${table.label}: ${table.count}`).join("\n")}`;
  }

  return "";
}
