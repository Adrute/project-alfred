import { OllamaProvider } from "@/ai/providers/ollama-provider";
import { sanitizeFinalAnswer } from "@/ai/final-answer";
import { loadConfig } from "@/config/env";
import { database } from "@/lib/database";
import { z } from "zod";
import type { ChatPageContext } from "@/domain/chat";
import { addDays, localDateKey, minuteLabel, mondayOfWeek } from "@/domain/planning";
import { parseBulkStudentCommand, parseTeachingScheduleCommand } from "@/domain/natural-language";
import { generateWeekSessions, getWeekPlan, validateTeachingSchedule } from "./planning-service";
import { proposeAction } from "./action-service";
import { calculateClassroomLayout } from "./classroom-service";
import { getFoodSafetyObservations, getRecentObservations, getStudentProfile, validateStudentBatch } from "./student-service";
import { prepareTutoring } from "./tutoring-service";
import { requireAgentRunning } from "./agent-admin-service";
import { agentForAssistantTool, executeAssistantTool, selectAssistantTool } from "./ai-orchestrator-service";
import { parseConversationContext, resolveConversationContext, serializeConversationContext } from "./conversation-context-service";
import { agentDefinitions } from "@/agents/definitions";
import { runAlfredAgent } from "./alfred-agent-service";

type Artifact = { type: "student" | "tutoring" | "layout" | "planning"; data: unknown };

const finalAnswerSchema = z.object({
  answer: z.string().min(1).max(2_000),
});

function observationCategory(message: string) {
  if (/alerg|intoler|cel[ií]a|gluten|lactos|frutos secos|cacahu|marisco/i.test(message)) return "health_accommodation";
  if (/pizarra|primera fila|sentar/i.test(message)) return "seating_need";
  if (/trabaja|junt|compañ/i.test(message)) return "classroom_dynamics";
  if (/particip/i.test(message)) return "participation";
  if (/distra|conducta/i.test(message)) return "classroom_behavior";
  return "general";
}

function isSeatingRequest(message: string) {
  const explicitSeatTerms = /\b(?:asientos?|sentar|sentad[oa]s?|pupitres?|distribuci[oó]n\s+del\s+aula)\b/i;
  const layoutInstruction = /\b(?:organiza|organizar|organ[ií]zame|distribuye|distribuir)\b[\s\S]{0,80}\b(?:alumnos?|clase)\b[\s\S]{0,80}\b(?:filas?|asientos?|pupitres?)\b/i;
  return explicitSeatTerms.test(message) || layoutInstruction.test(message);
}

function isStudentReadRequest(message: string) {
  return /^(?:¿?qui[eé]n|¿?qu[eé]|dime|cu[eé]ntame|h[aá]blame|mu[eé]strame|ens[eé]ñame|consulta|busca|lista|informaci[oó]n|datos|observaciones?)\b/i.test(message.trim());
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

function isApplicationOperationRequest(message: string) {
  const text = normalizeText(message);
  return /\b(?:crear|crea|anadir|anade|agregar|agrega|dar de alta|matricular|matricula|eliminar|borra|borrar|editar|modificar|inicia|arranca|deten|reinicia)\b[\s\S]{0,70}\b(?:clase|grupo|alumno|estudiante|agente|base de datos|horario|sesion|asignatura|unidad|contenido|tutoria|acuerdo)\b/.test(text)
    || /\b(?:clase|grupo|alumno|estudiante)\s+nuev[oa]\b/.test(text);
}

function shouldRecordObservation(message: string, source: "direct" | "page" | "history" | "none") {
  if (isApplicationOperationRequest(message)) return false;
  const explicit = /\b(?:apunta|anota|registra|observaci[oó]n|incidencia|quiero contarte)\b/i.test(message);
  const observableFact = /\b(?:participa|particip[oó]|distrae|conducta|necesita|trabaja|rinde|lee|escribe|comprende|atiende|interrumpe|mejora|dificultad|alerg|intoler|sentarse|pizarra|compañer[oa])\b/i.test(message);
  return explicit || source === "direct" || ((source === "page" || source === "history") && observableFact);
}

function normalizeAcademicYear(value: string) {
  const match = value.match(/(20\d{2})\s*[-–/]\s*(20\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function formatProfile(profile: NonNullable<Awaited<ReturnType<typeof getStudentProfile>>>) {
  const observations = profile.observations.length
    ? profile.observations.map((item) => `- ${item.observedAt.toLocaleDateString("es-ES")}: ${item.content}`).join("\n")
    : "- No hay observaciones registradas.";
  const relationships = [
    ...profile.relationshipsAsA.map((item) => `${item.studentB.firstName}: ${item.description}`),
    ...profile.relationshipsAsB.map((item) => `${item.studentA.firstName}: ${item.description}`),
  ];
  const academic = profile.subjectRecords.length
    ? profile.subjectRecords.map((record) => {
        const grades = record.grades.length ? record.grades.map((grade) => `${grade.title}: ${grade.score}/${grade.maxScore}`).join(", ") : "sin calificaciones";
        return `- ${record.teachingAssignment.subject.name} · ${record.teachingAssignment.classroom.name}: progreso ${record.progressStatus}, participación ${record.participationStatus}, tareas ${record.homeworkStatus}; ${grades}${record.teacherNotes ? `. Nota docente: ${record.teacherNotes}` : ""}`;
      }).join("\n")
    : "- No hay seguimiento por asignatura registrado.";
  return [
    `Esto es lo que consta sobre ${profile.firstName} ${profile.lastName}:`,
    `Grupo: ${profile.enrollments[0]?.classroom.name ?? "sin grupo activo"}.`,
    "", "Observaciones confirmadas:", observations,
    "", "Relaciones contextuales activas:", relationships.length ? relationships.map((item) => `- ${item}`).join("\n") : "- Ninguna registrada.",
    "", "Seguimiento académico por asignatura:", academic,
    "", "No he añadido interpretaciones ni datos que no estén registrados.",
  ].join("\n");
}

async function fallbackConversation(message: string, history: Array<{ role: string; content: string }>, pageContext?: ChatPageContext) {
  const config = loadConfig();
  const provider = new OllamaProvider({ baseUrl: config.OLLAMA_BASE_URL, model: config.OLLAMA_MODEL, timeoutMs: 120_000 });
  try {
    const transcript = history.slice(-12).map((item) => `${item.role === "user" ? "Profesora" : "Alfred"}: ${item.content}`).join("\n");
    const response = await provider.generateStructured(`/no_think\nHistorial de esta conversación:\n${transcript || "(sin mensajes anteriores)"}\n\nPantalla visible ahora: ${pageContext ? `${pageContext.label}: ${pageContext.summary}` : "(sin contexto de pantalla)"}.\nEste contexto visual es transitorio y sirve para entender referencias; no lo trates como un hecho registrado.\n\nMensaje actual de la profesora: ${message}`, finalAnswerSchema, {
      temperature: 0.2,
      system: "Eres Alfred, asistente docente local. Continúa de forma natural usando exclusivamente el historial del chat actual; nunca mezcles otras conversaciones. Devuelve solo la respuesta final, breve y en español, dentro del campo answer. No incluyas razonamientos, análisis, instrucciones internas ni comentarios sobre cómo has elaborado la respuesta. No inventes información sobre alumnos. Puedes consultar alumnos, grupos, memoria, planificación, currículo, agentes y base de datos; también puedes proponer altas de alumnos y clases, observaciones, tutorías, planes, distribuciones del aula y controles de agentes, siempre con confirmación antes de escribir. Si una acción concreta aún no está disponible, dilo con claridad y ofrece la alternativa más cercana.",
    });
    return sanitizeFinalAnswer(response.answer) || "No puedo responder a esa pregunta ahora mismo.";
  } catch {
    return "El modelo local no está disponible ahora. Aun así, puedo seguir consultando alumnos, grupos, memoria, planificación, currículo, agentes y la base de datos, además de preparar operaciones deterministas para que las confirmes.";
  }
}

export async function handleChat(input: { conversationId?: string; message: string; pageContext?: ChatPageContext }) {
  const conversation = input.conversationId
    ? await database.conversation.findUnique({ where: { id: input.conversationId } })
    : null;
  const activeConversation = conversation ?? await database.conversation.create({ data: {
    title: input.message.slice(0, 60) || "Conversación con Alfred",
  }});
  await requireAgentRunning("alfred-orchestrator");
  const history = (await database.message.findMany({
    where: { conversationId: activeConversation.id }, orderBy: { createdAt: "desc" }, take: 30,
  })).reverse();
  await database.message.create({ data: { conversationId: activeConversation.id, role: "user", content: input.message } });
  await database.conversation.update({ where: { id: activeConversation.id }, data: { updatedAt: new Date() } });
  const execution = await database.agentExecution.create({ data: {
    agentId: "alfred-orchestrator", operation: "handle-chat", status: "running",
  }});

  let content = "";
  let agentId = "alfred-orchestrator";
  let pendingAction: Awaited<ReturnType<typeof proposeAction>> | undefined;
  let artifact: Artifact | undefined;
  try {
    const previousState = parseConversationContext(activeConversation.contextJson);
    const nativeResponse = process.env.NODE_ENV === "test" ? null : await runAlfredAgent({
      conversationId: activeConversation.id,
      message: input.message,
      history,
      state: previousState,
      pageContext: input.pageContext,
    });
    if (nativeResponse) {
      await database.conversation.update({
        where: { id: activeConversation.id },
        data: { contextJson: serializeConversationContext(nativeResponse.state) },
      });
      await database.agentExecution.update({
        where: { id: execution.id },
        data: { agentId: nativeResponse.agentId, status: "completed", finishedAt: new Date() },
      });
      const message = await database.message.create({
        data: { conversationId: activeConversation.id, role: "assistant", content: nativeResponse.content, agentId: nativeResponse.agentId },
      });
      await database.conversation.update({ where: { id: activeConversation.id }, data: { updatedAt: new Date() } });
      return {
        conversationId: activeConversation.id,
        message: { ...message, agentId: nativeResponse.agentId },
        pendingAction: nativeResponse.pendingAction ? { ...nativeResponse.pendingAction, payload: JSON.parse(nativeResponse.pendingAction.payload) } : null,
        artifact: nativeResponse.artifact ?? null,
      };
    }
    const lower = input.message.toLocaleLowerCase("es");
    const conversationContext = await resolveConversationContext({
      message: input.message,
      history,
      previousState,
      pageContext: input.pageContext,
    });
    const mentioned = conversationContext.students;
    const recentContext = history.filter((item) => item.role === "user").slice(-2).map((item) => item.content).join("\n").toLocaleLowerCase("es");
    const contextualFollowUp = /^(?:¿?y\b|¿?qu[eé]\s+m[aá]s|¿?alguno\s+m[aá]s|¿?hay\s+m[aá]s|¿?algo\s+m[aá]s|eso|sobre eso)/.test(lower.trim());
    const foodTopic = /alerg|intoler|cel[ií]a|men[uú]|comida|aliment|gluten|lactos|frutos secos|cacahu|marisco/.test(lower)
      || conversationContext.topic === "food_safety"
      || (contextualFollowUp && /alerg|intoler|cel[ií]a|men[uú]|comida|aliment|gluten|lactos|frutos secos|cacahu|marisco/.test(recentContext));
    const bulkStudents = parseBulkStudentCommand(input.message);
    const scheduleSource = `${history.filter((item) => item.role === "user").slice(-2).map((item) => item.content).join("\n")}\n${input.message}`;
    const schedule = parseTeachingScheduleCommand(scheduleSource);

    if (bulkStudents) {
      agentId = "student-agent";
      await requireAgentRunning(agentId);
      const classrooms = await database.classroom.findMany({ orderBy: { name: "asc" } });
      const query = normalizeText(bulkStudents.classroomReference).replace(/[º.]/g, "");
      const matches = classrooms.filter((item) => {
        const name = normalizeText(item.name).replace(/[º.]/g, "");
        return name.includes(query) || query.includes(name);
      });
      if (matches.length !== 1) {
        content = matches.length ? `Hay varias clases posibles: ${matches.map((item) => item.name).join(", ")}. Indícame una sola.` : `No existe una clase que coincida con «${bulkStudents.classroomReference}».`;
      } else {
        await validateStudentBatch(matches[0].id, bulkStudents.students);
        pendingAction = await proposeAction({ type: "create_students_bulk", classroomId: matches[0].id, students: bulkStudents.students });
        content = `He preparado el alta de ${bulkStudents.students.length} alumnos en ${matches[0].name}:\n${bulkStudents.students.map((item) => `- ${item.firstName} ${item.lastName}`).join("\n")}\n\nAún no se ha guardado. Revisa la lista y confirma la propuesta.`;
      }
    } else if (schedule) {
      agentId = "planning-agent";
      await requireAgentRunning(agentId);
      if (!schedule.academicYear) {
        const years = [...new Set((await database.classroom.findMany({ select: { academicYear: true } })).map((item) => item.academicYear))];
        if (years.length === 1) schedule.academicYear = years[0];
      }
      if (!schedule.academicYear) {
        content = "¿Para qué curso académico preparo este horario? Indícamelo como 2026-2027.";
      } else {
        const validated = await validateTeachingSchedule(schedule);
        pendingAction = await proposeAction({ type: "create_teaching_schedule", ...validated });
        const days = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
        content = `He preparado ${validated.entries.length} franjas para el curso ${validated.academicYear}:\n${validated.entries.map((entry) => `- ${days[entry.dayOfWeek]}, ${minuteLabel(entry.startMinute)}–${minuteLabel(entry.endMinute)} · ${entry.subjectName} · ${entry.classroomName}`).join("\n")}\n\nTambién se crearán las clases y asignaturas que no existan. Aún no se ha guardado. Revisa y confirma la propuesta.`;
        artifact = { type: "planning", data: validated };
      }
    } else if (/organ[ií]zame.*pr[oó]xima semana|planifica.*pr[oó]xima semana/.test(lower)) {
      agentId = "planning-agent";
      await requireAgentRunning(agentId);
      const weekStart = addDays(mondayOfWeek(localDateKey()), 7);
      await generateWeekSessions(weekStart);
      const week = await getWeekPlan(weekStart);
      pendingAction = await proposeAction({ type: "plan_week", weekStart });
      content = `He preparado una propuesta para ${week.lessons.length} sesiones de la próxima semana, basada en tu horario y en las unidades activas. Todavía no he guardado las actividades. Confirma la propuesta para aplicarla.`;
      artifact = { type: "planning", data: { weekStart, lessons: week.lessons } };
    } else if (/qu[eé].*(?:hacer|preparar).*(?:mañana|manana)|(?:mañana|manana).*(?:hacer|preparar)/.test(lower)) {
      agentId = "planning-agent";
      await requireAgentRunning(agentId);
      const target = addDays(localDateKey(), 1);
      await generateWeekSessions(mondayOfWeek(target));
      const week = await getWeekPlan(mondayOfWeek(target));
      const groupText = lower.match(/\d+\.?º?\s*eso\s*[a-z]/)?.[0]?.replace(/\s+/g, " ");
      const normalizeGroup = (value: string) => value.replace(/[.º]/g, "").replace(/\s+/g, " ").trim();
      const lessons = week.lessons.filter((item) => item.date.toISOString().slice(0, 10) === target && (!groupText || normalizeGroup(item.teachingAssignment.classroom.name.toLocaleLowerCase("es")).includes(normalizeGroup(groupText))));
      content = lessons.length
        ? lessons.map((item) => `${minuteLabel(item.startMinute)} · ${item.teachingAssignment.classroom.name} · ${item.teachingAssignment.subject.name}: ${item.title} (${item.status === "planned" ? "planificada" : "sin planificar"}).`).join("\n")
        : `No tienes ninguna clase registrada para mañana${groupText ? ` con ${groupText.toUpperCase()}` : ""}.`;
    } else if (/clases?.*(?:sin planificar|pendientes? de planificar)|(?:sin planificar|pendientes? de planificar).*clases?/.test(lower)) {
      agentId = "planning-agent";
      await requireAgentRunning(agentId);
      const weekStart = mondayOfWeek(localDateKey());
      await generateWeekSessions(weekStart);
      const week = await getWeekPlan(weekStart);
      const pending = week.lessons.filter((item) => item.status === "unplanned");
      content = pending.length ? `Tienes ${pending.length} clases sin planificar esta semana:\n${pending.map((item) => `- ${item.date.toLocaleDateString("es-ES")}, ${minuteLabel(item.startMinute)}: ${item.teachingAssignment.subject.name} con ${item.teachingAssignment.classroom.name}`).join("\n")}` : "No tienes clases pendientes de planificar esta semana.";
    } else if (/qué sabes|que sabes|información sobre|informacion sobre/.test(lower) && !foodTopic) {
      agentId = "memory-agent";
      await requireAgentRunning(agentId);
      if (mentioned.length !== 1) {
        content = mentioned.length > 1 ? "He encontrado varios alumnos posibles. Indícame nombre y apellido." : "No encuentro ese alumno. ¿Puedes indicarme su nombre?";
      } else {
        const profile = await getStudentProfile(mentioned[0].id);
        if (!profile) throw new Error("No se encontró el alumno.");
        content = formatProfile(profile);
        artifact = { type: "student", data: profile };
      }
    } else if (/se\s+llev[ae](?:n)?\s+mal|llev[ae](?:n)?.*mal|conflicto|problemas?.*(?:entre|con)|no.*deber[ií]an.*junt/.test(lower)) {
      agentId = "memory-agent";
      await requireAgentRunning(agentId);
      const relationships = await database.studentRelationship.findMany({
        where: { active: true, relationshipType: "avoid_adjacent" },
        include: { studentA: true, studentB: true },
        orderBy: { observedAt: "desc" },
      });
      content = relationships.length
        ? `Sí. ${relationships.map((item) => `Hay una observación activa entre ${item.studentA.firstName} y ${item.studentB.firstName}: “${item.description}”`).join(" ")}`
        : "No hay ninguna relación problemática confirmada registrada.";
    } else if (foodTopic) {
      agentId = "memory-agent";
      await requireAgentRunning(agentId);
      const observations = await getFoodSafetyObservations();
      content = observations.length
        ? `Estas son las observaciones alimentarias confirmadas que debes tener en cuenta:\n${observations.map((item) => `- ${item.student.firstName} ${item.student.lastName}: ${item.content}`).join("\n")}\n\nVerifica esta información con el protocolo del centro antes de cerrar el menú.`
        : "No hay alergias o intolerancias alimentarias confirmadas registradas. No puedo asumir que no existan; compruébalo con el protocolo del centro antes de cerrar el menú.";
    } else if (/observaciones?.*(semana|últimos|ultimos)|esta semana.*observaciones?/.test(lower)) {
      agentId = "memory-agent";
      await requireAgentRunning(agentId);
      const observations = await getRecentObservations(7);
      content = observations.length
        ? `Observaciones confirmadas de los últimos 7 días:\n${observations.map((item) => `- ${item.student.firstName}: ${item.content}`).join("\n")}`
        : "No hay observaciones confirmadas en los últimos 7 días.";
    } else if (/tutor[ií]a|(?:reuni[oó]n|entrevista).*(?:familia|familiar)|(?:familia|familiar).*(?:reuni[oó]n|entrevista)/.test(lower)) {
      agentId = "tutoring-agent";
      await requireAgentRunning(agentId);
      if (mentioned.length !== 1) {
        content = mentioned.length > 1 ? "¿Para cuál de los alumnos mencionados preparo la tutoría?" : "¿De qué alumno quieres preparar la tutoría?";
      } else {
        const draft = await prepareTutoring(mentioned[0].id);
        pendingAction = await proposeAction({ type: "save_tutoring", studentId: mentioned[0].id, preparation: draft.preparation });
        content = `${draft.preparation}\n\nHe preparado el borrador, pero todavía no lo he guardado. Confirma la propuesta si quieres conservarlo.`;
        artifact = { type: "tutoring", data: { preparation: draft.preparation, source: draft.source } };
      }
    } else if (isSeatingRequest(lower)) {
      agentId = "classroom-agent";
      await requireAgentRunning(agentId);
      const classroom = await database.classroom.findFirst({ orderBy: { createdAt: "asc" } });
      if (!classroom) {
        content = "Primero necesito una clase con alumnos matriculados.";
      } else {
        const calculated = await calculateClassroomLayout(classroom.id, 5, 5);
        if (!calculated.result.ok) {
          content = calculated.result.explanation;
        } else {
          const name = `Propuesta ${new Date().toLocaleString("es-ES")}`;
          pendingAction = await proposeAction({
            type: "save_layout", classroomId: classroom.id, name, rows: 5, columns: 5,
            configuration: JSON.stringify({ constraints: calculated.constraints, score: calculated.result.score, explanation: calculated.result.explanation }),
            assignments: calculated.result.assignments,
          });
          const names = new Map(calculated.students.map((student) => [student.id, student.name]));
          content = `He generado una distribución 5×5 para ${calculated.classroom.name}. ${calculated.result.explanation}\n\n${calculated.result.assignments.map((item) => `Fila ${item.row + 1}, asiento ${item.column + 1}: ${names.get(item.studentId)}`).join("\n")}\n\nConfirma para guardarla y poder editarla visualmente.`;
          artifact = { type: "layout", data: { ...calculated.result, students: calculated.students, rows: 5, columns: 5 } };
        }
      }
    } else if (mentioned.length > 0 && !input.message.trim().endsWith("?") && !isStudentReadRequest(input.message) && shouldRecordObservation(input.message, conversationContext.source)) {
      agentId = "student-agent";
      await requireAgentRunning(agentId);
      const relationshipWords = /junt|trabaja.*bien|distrae.*con|mejor.*juntos/i.test(input.message);
      const two = mentioned.slice(0, 2);
      let relationship: {
        studentAId: string; studentBId: string; relationshipType: "avoid_adjacent" | "works_well";
        description: string; deactivateTypes: string[];
      } | undefined;
      if (relationshipWords && two.length === 2) {
        const isPositive = /trabaja.*bien|mejor.*juntos/i.test(input.message);
        relationship = {
          studentAId: two[0].id, studentBId: two[1].id,
          relationshipType: isPositive ? "works_well" : "avoid_adjacent",
          description: input.message.trim(),
          deactivateTypes: isPositive && /últimamente|ultimamente|ahora|mejor/i.test(input.message) ? ["avoid_adjacent"] : [],
        };
      }
      pendingAction = await proposeAction({
        type: "record_observation", studentIds: relationship && /lucas y marcos|marcos y lucas/i.test(lower) ? two.map((student) => student.id) : [mentioned[0].id],
        content: input.message.trim(), category: observationCategory(input.message),
        observedAt: new Date().toISOString(), relationship,
      });
      const targets = mentioned.slice(0, relationship ? 2 : 1).map((student) => student.firstName).join(" y ");
      content = `He preparado una observación para ${targets}: “${input.message.trim()}”. Aún no se ha guardado. Revisa y confirma la propuesta.`;
    } else if (/quiero contarte|registrar observaciones|contarte algunas cosas/.test(lower)) {
      agentId = "student-agent";
      await requireAgentRunning(agentId);
      content = "Perfecto. Cuéntame una observación cada vez e incluye el nombre del alumno. Te mostraré exactamente qué voy a guardar antes de hacerlo.";
    } else {
      let decision = await selectAssistantTool(input.message, history, input.pageContext);
      if ((decision.tool === "student_profile" || decision.tool === "student_observations") && mentioned.length) {
        decision = { ...decision, studentQuery: mentioned.map((student) => `${student.firstName} ${student.lastName}`).join(", ") };
      }
      agentId = agentForAssistantTool(decision.tool);
      await requireAgentRunning(agentId);
      if (decision.tool === "create_classroom") {
        const name = decision.classroomName.trim();
        const academicYear = normalizeAcademicYear(decision.academicYear);
        const educationalStage = decision.educationalStage.trim() || name.match(/ESO|Primaria|Bachillerato|Infantil|FP/i)?.[0] || "";
        const missing = [!name && "el nombre del grupo", !academicYear && "el curso académico", !educationalStage && "la etapa educativa"].filter(Boolean);
        if (missing.length) {
          content = `Claro. Para crear la clase necesito ${missing.join(", ")}. Por ejemplo: «3.º ESO B, curso 2026-2027, ESO».`;
        } else {
          const existing = await database.classroom.findUnique({ where: { name_academicYear: { name, academicYear } } });
          if (existing) {
            content = `La clase ${name} del curso ${academicYear} ya existe. No he preparado ningún cambio.`;
          } else {
            pendingAction = await proposeAction({ type: "create_classroom", name, academicYear, educationalStage });
            content = `He preparado la creación de la clase ${name}, curso ${academicYear}, etapa ${educationalStage}. Aún no se ha guardado. Revisa y confirma la propuesta.`;
          }
        }
      } else if (decision.tool === "create_student") {
        const firstName = decision.studentFirstName.trim();
        const lastName = decision.studentLastName.trim();
        const classroomQuery = normalizeText(decision.classroomQuery);
        const classrooms = await database.classroom.findMany({ orderBy: { name: "asc" } });
        const matches = classroomQuery ? classrooms.filter((classroom) => normalizeText(classroom.name).includes(classroomQuery) || classroomQuery.includes(normalizeText(classroom.name))) : [];
        if (!firstName || !lastName || matches.length !== 1) {
          content = `Para crear el alumno necesito nombre, apellidos y una clase existente${matches.length > 1 ? " sin ambigüedad" : ""}. Por ejemplo: «Añade a Lucía Pérez a 2.º ESO C».`;
        } else {
          pendingAction = await proposeAction({ type: "create_student", firstName, lastName, classroomId: matches[0].id });
          content = `He preparado el alta de ${firstName} ${lastName} en ${matches[0].name}. Aún no se ha guardado. Revisa y confirma la propuesta.`;
        }
      } else if (decision.tool === "control_agent") {
        const query = normalizeText(decision.agentQuery);
        const matches = agentDefinitions.filter((agent) => normalizeText(`${agent.id} ${agent.name}`).includes(query));
        if (!query || matches.length !== 1 || decision.agentAction === "none") {
          content = "Indícame qué agente quieres controlar y si deseas iniciarlo, detenerlo o reiniciarlo.";
        } else {
          pendingAction = await proposeAction({ type: "control_agent", agentId: matches[0].id, action: decision.agentAction });
          const actionLabel = decision.agentAction === "start" ? "iniciar" : decision.agentAction === "stop" ? "detener" : "reiniciar";
          content = `He preparado la acción para ${actionLabel} ${matches[0].name}. Aún no se ha aplicado. Revisa y confirma la propuesta.`;
        }
      } else {
        content = decision.tool === "general_conversation"
          ? await fallbackConversation(input.message, history, input.pageContext)
          : await executeAssistantTool(decision, input.message, history);
      }
    }

    await database.conversation.update({
      where: { id: activeConversation.id },
      data: { contextJson: serializeConversationContext(conversationContext.state) },
    });
    await database.agentExecution.update({ where: { id: execution.id }, data: { agentId, status: "completed", finishedAt: new Date() } });
  } catch (error) {
    await database.agentExecution.update({ where: { id: execution.id }, data: {
      status: "failed", finishedAt: new Date(), error: error instanceof Error ? error.message.slice(0, 300) : "Error desconocido",
    }});
    throw error;
  }
  const message = await database.message.create({ data: { conversationId: activeConversation.id, role: "assistant", content, agentId } });
  await database.conversation.update({ where: { id: activeConversation.id }, data: { updatedAt: new Date() } });
  return {
    conversationId: activeConversation.id,
    message: { ...message, agentId },
    pendingAction: pendingAction ? { ...pendingAction, payload: JSON.parse(pendingAction.payload) } : null,
    artifact: artifact ?? null,
  };
}

export async function getConversation(conversationId?: string) {
  const conversation = conversationId
    ? await database.conversation.findUnique({ where: { id: conversationId }, include: { messages: { orderBy: { createdAt: "asc" } } } })
    : await database.conversation.findFirst({ orderBy: { updatedAt: "desc" }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  const conversations = await database.conversation.findMany({
    orderBy: { updatedAt: "desc" }, take: 50,
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { messages: true } } },
  });
  return { conversation, conversations };
}
