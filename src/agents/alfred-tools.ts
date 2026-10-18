import { z } from "zod";
import type { LlmToolDefinition } from "@/ai/providers/llm-provider";
import { agentDefinitions } from "@/agents/definitions";
import { addDays, localDateKey, minuteLabel, mondayOfWeek } from "@/domain/planning";
import { database } from "@/lib/database";
import { proposeAction } from "@/services/action-service";
import { getAgentDashboard, requireAgentRunning } from "@/services/agent-admin-service";
import { calculateClassroomLayout, listClassrooms } from "@/services/classroom-service";
import { getDatabaseOverview } from "@/services/database-admin-service";
import { getCurriculumOverview, getWeekPlan, validateTeachingSchedule } from "@/services/planning-service";
import {
  getFoodSafetyObservations,
  getRecentObservations,
  getStudentProfile,
  listStudents,
  resolveStudents,
  validateStudentBatch,
} from "@/services/student-service";
import { prepareTutoring } from "@/services/tutoring-service";
import { dispatchInternalA2A, type InternalA2AContext } from "@/services/internal-a2a-service";

const emptyInput = z.object({}).strict();
const studentSearchInput = z.object({
  output: z.enum(["count", "names", "table"])
    .describe("Formato solicitado: solo recuento, nombres o tabla.")
    .default("names"),
  nameStartsWith: z.string().max(30)
    .describe("Prefijo del nombre de pila, sin incluir apellidos. Vacío si no se pidió.")
    .default(""),
  nameEndsWith: z.string().max(30)
    .describe("Sufijo del nombre de pila. Vacío si no se pidió.")
    .default(""),
  nameContains: z.string().max(80)
    .describe("Texto que debe aparecer en el nombre completo. Vacío si no se pidió.")
    .default(""),
  classroom: z.string().max(80)
    .describe("Nombre o referencia de la clase. Vacío si no se pidió.")
    .default(""),
  observationMode: z.enum(["any", "with", "without"])
    .describe("Filtra por presencia de observaciones solo cuando la profesora lo solicite.")
    .default("any"),
  observationContains: z.string().max(120)
    .describe("Texto que debe aparecer en alguna observación. Vacío si no se pidió.")
    .default(""),
  limit: z.number().int().min(1).max(100)
    .describe("Máximo de resultados; usa 50 salvo que se pida otro límite.")
    .default(50),
}).strict();
const studentReferenceInput = z.object({
  studentReference: z.string().min(1).max(160)
    .describe("Referencia tal como la expresó la profesora: puede ser nombre, nombre completo o id del contexto. El servicio resuelve coincidencias y comunica cualquier ambigüedad."),
}).strict();
const observationsInput = z.object({
  studentReference: z.string().max(160).default(""),
  days: z.number().int().min(1).max(3650).default(3650),
}).strict();
const planningInput = z.object({
  period: z.enum(["current_week", "next_week", "tomorrow"]).default("current_week"),
  classroom: z.string().max(80).default(""),
}).strict();
const curriculumInput = z.object({
  classroom: z.string().max(80).default(""),
  subject: z.string().max(80).default(""),
}).strict();
const createClassroomInput = z.object({
  name: z.string().trim().min(2).max(80),
  academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/),
  educationalStage: z.string().trim().min(2).max(80),
}).strict();
const createStudentInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(120),
  classroomReference: z.string().trim().min(1).max(100),
}).strict();
const createStudentsBulkInput = z.object({
  classroomReference: z.string().trim().min(1).max(100),
  students: z.array(z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(120),
  }).strict()).min(2).max(100)
    .describe("Todos los alumnos nombrados explícitamente. Separa el nombre de pila de todos sus apellidos; no inventes apellidos."),
}).strict();
const createTeachingScheduleInput = z.object({
  academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/)
    .describe("Curso académico explícito o confirmado en el diálogo, en formato YYYY-YYYY."),
  timezone: z.literal("Europe/Madrid").default("Europe/Madrid"),
  entries: z.array(z.object({
    classroomName: z.string().trim().min(2).max(80),
    educationalStage: z.string().trim().min(2).max(80)
      .describe("Etapa inferible literalmente del grupo: ESO, Primaria, Bachillerato, Infantil o FP."),
    subjectName: z.string().trim().min(2).max(100),
    dayOfWeek: z.number().int().min(1).max(7)
      .describe("1 lunes, 2 martes, 3 miércoles, 4 jueves, 5 viernes, 6 sábado, 7 domingo."),
    startMinute: z.number().int().min(0).max(1_439)
      .describe("Minutos desde las 00:00. 09:30 equivale a 570."),
    endMinute: z.number().int().min(1).max(1_440)
      .describe("Minutos desde las 00:00. Debe proceder de la hora final indicada; no inventes duración."),
    room: z.string().trim().max(80).optional().nullable(),
  }).strict()).min(1).max(100),
}).strict();
const observationInput = z.object({
  studentReferences: z.array(z.string().trim().min(1).max(160)).min(1).max(2)
    .describe("Nombres o referencias tal como los dijo la profesora. Un nombre de pila es suficiente para llamar la herramienta: el servicio comprueba si es único; no pidas antes apellido ni clase."),
  content: z.string().trim().min(3).max(2_000)
    .describe("El hecho expresado por la profesora, conservando su significado y sin añadir información."),
  category: z.enum(["general", "participation", "classroom_behavior", "classroom_dynamics", "seating_need", "health_accommodation"])
    .describe("Infiérela del hecho cuando sea evidente; usa general si no lo es. No preguntes a la profesora solo por esta categoría técnica.")
    .default("general"),
  relationshipType: z.enum(["none", "avoid_adjacent", "works_well"])
    .describe("Usa un tipo de relación solo si el hecho se refiere a exactamente dos alumnos; en otro caso usa none.")
    .default("none"),
}).strict();
const seatingInput = z.object({
  classroomReference: z.string().max(100)
    .describe("Clase indicada por la profesora. Déjala vacía si no la menciona: el servicio elegirá la única clase con alumnado o devolverá las opciones si hay varias.")
    .default(""),
  rows: z.number().int().min(1).max(12)
    .describe("Número de filas; infiérelo de la petición y usa 5 si no se indica.")
    .default(5),
  columns: z.number().int().min(1).max(12)
    .describe("Asientos por fila; infiérelo de la petición y usa 5 si no se indica.")
    .default(5),
  studentCount: z.number().int().min(0).max(144)
    .describe("Número de alumnos mencionado por la profesora. Usa 0 si no indicó ninguno; sirve para resolver la clase correcta.")
    .default(0),
}).strict();
const controlAgentInput = z.object({
  agentReference: z.string().trim().min(1).max(120),
  action: z.enum(["start", "stop", "restart"]),
}).strict();

type ToolSchema = z.ZodObject;
type PendingAction = Awaited<ReturnType<typeof proposeAction>>;

export interface AlfredToolResult {
  modelResult: Record<string, unknown>;
  summary: string;
  exactResponse?: string;
  agentId: string;
  topic: "students" | "observations" | "tutoring" | "seating" | "food_safety" | "planning" | "curriculum" | "classrooms" | "general";
  activeStudentIds?: string[];
  pendingAction?: PendingAction;
  artifact?: { type: "student" | "tutoring" | "layout" | "planning"; data: unknown };
}

interface AlfredTool {
  name: string;
  description: string;
  schema: ToolSchema;
  execute(input: Record<string, unknown>): Promise<AlfredToolResult>;
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();

async function resolveOneStudent(reference: string) {
  const byId = await database.student.findUnique({ where: { id: reference } });
  if (byId) return { matches: [byId], student: byId };
  const matches = await resolveStudents(reference);
  if (matches.length !== 1) return { matches, student: null };
  return { matches, student: matches[0] };
}

async function resolveOneClassroom(reference: string, expectedStudentCount = 0) {
  const classrooms = await listClassrooms();
  const query = normalize(reference);
  const matches = query
    ? classrooms.filter((item) => normalize(item.name).includes(query) || query.includes(normalize(item.name)))
    : classrooms.filter((item) => item.enrollments.length > 0 && (!expectedStudentCount || item.enrollments.length === expectedStudentCount));
  return { matches, classroom: matches.length === 1 ? matches[0] : null };
}

function studentResolutionFailure(reference: string, matches: Awaited<ReturnType<typeof resolveStudents>>) : AlfredToolResult {
  const summary = matches.length
    ? `Hay varios alumnos que coinciden con «${reference}»: ${matches.map((item) => `${item.firstName} ${item.lastName}`).join(", ")}. ¿Puedes indicarme nombre y apellidos?`
    : `No existe ningún alumno que coincida con «${reference}». ¿Puedes indicarme su nombre y apellidos?`;
  return { modelResult: { ok: false, reason: "student_not_unique", candidates: matches.map((item) => `${item.firstName} ${item.lastName}`) }, summary, exactResponse: summary, agentId: "student-agent", topic: "students" };
}

const tools: AlfredTool[] = [
  {
    name: "search_students",
    description: "Cuenta, lista o tabula alumnos usando filtros combinables de nombre, clase y observaciones. Úsala para cualquier consulta sobre conjuntos de alumnos.",
    schema: studentSearchInput,
    async execute(raw) {
      await requireAgentRunning("student-agent");
      const input = studentSearchInput.parse(raw);
      const starts = normalize(input.nameStartsWith);
      const ends = normalize(input.nameEndsWith);
      const contains = normalize(input.nameContains);
      const classroom = normalize(input.classroom).replace(/[º.]/g, "");
      const observationContains = normalize(input.observationContains);
      const students = (await listStudents()).filter((student) => {
        const firstName = normalize(student.firstName);
        const fullName = normalize(`${student.firstName} ${student.lastName}`);
        const group = normalize(student.enrollments[0]?.classroom.name ?? "").replace(/[º.]/g, "");
        const observations = student.observations.map((item) => normalize(item.content));
        return (!starts || firstName.startsWith(starts))
          && (!ends || firstName.endsWith(ends))
          && (!contains || fullName.includes(contains))
          && (!classroom || group.includes(classroom) || classroom.includes(group))
          && (!observationContains || observations.some((item) => item.includes(observationContains)))
          && (input.observationMode === "any" || (input.observationMode === "with" ? observations.length > 0 : observations.length === 0));
      }).slice(0, input.limit);
      const result = {
        ok: true,
        count: students.length,
        requestedOutput: input.output,
        appliedFilters: input,
        students: students.map((student) => ({
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          classroom: student.enrollments[0]?.classroom.name ?? null,
          observations: input.output === "table" ? student.observations.map((item) => item.content) : undefined,
        })),
      };
      const summary = `${students.length} ${students.length === 1 ? "alumno encontrado" : "alumnos encontrados"}.`;
      return { modelResult: result, summary, agentId: "student-agent", topic: "students", activeStudentIds: students.length <= 6 ? students.map((item) => item.id) : [] };
    },
  },
  {
    name: "get_student_profile",
    description: "Obtiene la ficha completa de un alumno: grupo, observaciones, relaciones y seguimiento académico confirmado por cada asignatura, incluidas calificaciones. Requiere una referencia sin ambigüedad.",
    schema: studentReferenceInput,
    async execute(raw) {
      await requireAgentRunning("memory-agent");
      const input = studentReferenceInput.parse(raw);
      const resolved = await resolveOneStudent(input.studentReference);
      if (!resolved.student) return studentResolutionFailure(input.studentReference, resolved.matches);
      const profile = await getStudentProfile(resolved.student.id);
      if (!profile) throw new Error("No se encontró el alumno solicitado.");
      const result = {
        ok: true,
        student: { id: profile.id, name: `${profile.firstName} ${profile.lastName}`, classroom: profile.enrollments[0]?.classroom.name ?? null },
        observations: profile.observations.map((item) => ({ date: item.observedAt.toISOString().slice(0, 10), content: item.content, category: item.category })),
        relationships: [
          ...profile.relationshipsAsA.map((item) => ({ student: `${item.studentB.firstName} ${item.studentB.lastName}`, type: item.relationshipType, description: item.description })),
          ...profile.relationshipsAsB.map((item) => ({ student: `${item.studentA.firstName} ${item.studentA.lastName}`, type: item.relationshipType, description: item.description })),
        ],
        academicRecords: profile.subjectRecords.map((record) => ({
          subject: record.teachingAssignment.subject.name,
          classroom: record.teachingAssignment.classroom.name,
          progress: record.progressStatus,
          participation: record.participationStatus,
          homework: record.homeworkStatus,
          teacherNotes: record.teacherNotes,
          supportNotes: record.supportNotes,
          grades: record.grades.map((grade) => ({ title: grade.title, period: grade.assessmentPeriod, score: grade.score, maxScore: grade.maxScore, weight: grade.weight })),
        })),
      };
      return { modelResult: result, summary: `Ficha confirmada de ${profile.firstName} ${profile.lastName}.`, agentId: "memory-agent", topic: "students", activeStudentIds: [profile.id], artifact: { type: "student", data: profile } };
    },
  },
  {
    name: "get_student_observations",
    description: "Consulta observaciones confirmadas, de un alumno concreto o de todo el alumnado durante un periodo.",
    schema: observationsInput,
    async execute(raw) {
      await requireAgentRunning("memory-agent");
      const input = observationsInput.parse(raw);
      if (input.studentReference) {
        const resolved = await resolveOneStudent(input.studentReference);
        if (!resolved.student) return studentResolutionFailure(input.studentReference, resolved.matches);
        const profile = await getStudentProfile(resolved.student.id);
        const observations = profile?.observations.map((item) => ({ date: item.observedAt.toISOString().slice(0, 10), content: item.content, category: item.category })) ?? [];
        return { modelResult: { ok: true, student: `${resolved.student.firstName} ${resolved.student.lastName}`, observations }, summary: `${observations.length} observaciones confirmadas.`, agentId: "memory-agent", topic: "observations", activeStudentIds: [resolved.student.id] };
      }
      const observations = await getRecentObservations(input.days);
      return { modelResult: { ok: true, observations: observations.map((item) => ({ studentId: item.studentId, student: `${item.student.firstName} ${item.student.lastName}`, date: item.observedAt.toISOString().slice(0, 10), content: item.content, category: item.category })) }, summary: `${observations.length} observaciones confirmadas.`, agentId: "memory-agent", topic: "observations" };
    },
  },
  {
    name: "get_food_safety",
    description: "Consulta exclusivamente información alimentaria confirmada: alergias, intolerancias y adaptaciones relevantes para comidas o excursiones.",
    schema: emptyInput,
    async execute() {
      await requireAgentRunning("memory-agent");
      const observations = await getFoodSafetyObservations();
      return { modelResult: { ok: true, warning: "Verificar siempre con el protocolo del centro.", observations: observations.map((item) => ({ studentId: item.studentId, student: `${item.student.firstName} ${item.student.lastName}`, content: item.content })) }, summary: `${observations.length} observaciones alimentarias confirmadas.`, agentId: "memory-agent", topic: "food_safety", activeStudentIds: observations.length <= 6 ? observations.map((item) => item.studentId) : [] };
    },
  },
  {
    name: "get_student_relationships",
    description: "Consulta relaciones confirmadas entre alumnos, por ejemplo quiénes deben estar separados o trabajan bien juntos.",
    schema: emptyInput,
    async execute() {
      await requireAgentRunning("memory-agent");
      const relationships = await database.studentRelationship.findMany({ where: { active: true }, include: { studentA: true, studentB: true }, orderBy: { observedAt: "desc" } });
      return { modelResult: { ok: true, relationships: relationships.map((item) => ({ studentA: `${item.studentA.firstName} ${item.studentA.lastName}`, studentB: `${item.studentB.firstName} ${item.studentB.lastName}`, type: item.relationshipType, description: item.description })) }, summary: `${relationships.length} relaciones activas confirmadas.`, agentId: "memory-agent", topic: "observations" };
    },
  },
  {
    name: "list_classrooms",
    description: "Lista las clases o grupos registrados con etapa, curso académico y número de alumnos.",
    schema: emptyInput,
    async execute() {
      await requireAgentRunning("classroom-agent");
      const classrooms = await listClassrooms();
      return { modelResult: { ok: true, classrooms: classrooms.map((item) => ({ id: item.id, name: item.name, academicYear: item.academicYear, educationalStage: item.educationalStage, studentCount: item.enrollments.length })) }, summary: `${classrooms.length} clases registradas.`, agentId: "classroom-agent", topic: "classrooms" };
    },
  },
  {
    name: "get_planning",
    description: "Consulta las clases y la planificación de mañana, de esta semana o de la próxima semana. Puede filtrar por clase.",
    schema: planningInput,
    async execute(raw) {
      await requireAgentRunning("planning-agent");
      const input = planningInput.parse(raw);
      const today = localDateKey();
      const weekStart = input.period === "next_week" ? addDays(mondayOfWeek(today), 7) : mondayOfWeek(today);
      const week = await getWeekPlan(weekStart);
      const tomorrow = addDays(today, 1);
      const classroom = normalize(input.classroom).replace(/[º.]/g, "");
      const lessons = week.lessons.filter((item) => {
        const group = normalize(item.teachingAssignment.classroom.name).replace(/[º.]/g, "");
        return (input.period !== "tomorrow" || item.date.toISOString().slice(0, 10) === tomorrow)
          && (!classroom || group.includes(classroom) || classroom.includes(group));
      });
      return { modelResult: { ok: true, period: input.period, lessons: lessons.map((item) => ({ id: item.id, date: item.date.toISOString().slice(0, 10), start: minuteLabel(item.startMinute), end: minuteLabel(item.endMinute), classroom: item.teachingAssignment.classroom.name, subject: item.teachingAssignment.subject.name, title: item.title, status: item.status })) }, summary: `${lessons.length} sesiones encontradas.`, agentId: "planning-agent", topic: "planning" };
    },
  },
  {
    name: "get_curriculum",
    description: "Consulta asignaturas, unidades, contenidos y progreso curricular, con filtros opcionales de clase y asignatura.",
    schema: curriculumInput,
    async execute(raw) {
      await requireAgentRunning("curriculum-agent");
      const input = curriculumInput.parse(raw);
      const classroom = normalize(input.classroom);
      const subject = normalize(input.subject);
      const assignments = (await getCurriculumOverview()).filter((item) => (!classroom || normalize(item.classroom.name).includes(classroom)) && (!subject || normalize(item.subject.name).includes(subject)));
      return { modelResult: { ok: true, assignments: assignments.map((item) => ({ classroom: item.classroom.name, subject: item.subject.name, units: item.teachingUnits.map((unit) => ({ title: unit.title, status: unit.status, contents: unit.contents.map((content) => ({ title: content.title, status: content.status })) })) })) }, summary: `${assignments.length} asignaciones curriculares encontradas.`, agentId: "curriculum-agent", topic: "curriculum" };
    },
  },
  {
    name: "get_agent_dashboard",
    description: "Consulta el estado, actividad, errores y estadísticas de los agentes internos de Alfred.",
    schema: emptyInput,
    async execute() {
      const agents = await getAgentDashboard();
      return { modelResult: { ok: true, agents: agents.map((agent) => ({ id: agent.id, name: agent.name, status: agent.runtime?.status ?? "running", executions: agent.statistics.totalExecutions, successRate: agent.statistics.successRate })) }, summary: `${agents.length} agentes consultados.`, agentId: "alfred-orchestrator", topic: "general" };
    },
  },
  {
    name: "get_database_overview",
    description: "Consulta el estado y los recuentos de la base de datos local. No modifica ni elimina información.",
    schema: emptyInput,
    async execute() {
      const overview = await getDatabaseOverview("students");
      return { modelResult: { ok: true, engine: overview.engine, totalRecords: overview.totalRecords, tables: overview.tables.map((table) => ({ name: table.key, label: table.label, count: table.count })) }, summary: `${overview.totalRecords} registros en ${overview.tables.length} tablas administradas.`, agentId: "alfred-orchestrator", topic: "general" };
    },
  },
  {
    name: "propose_create_classroom",
    description: "Prepara la creación de una clase. Requiere nombre, curso académico YYYY-YYYY y etapa. No guarda nada hasta confirmación explícita.",
    schema: createClassroomInput,
    async execute(raw) {
      await requireAgentRunning("classroom-agent");
      const input = createClassroomInput.parse(raw);
      const existing = await database.classroom.findUnique({ where: { name_academicYear: { name: input.name, academicYear: input.academicYear } } });
      if (existing) {
        const summary = `La clase ${input.name} del curso ${input.academicYear} ya existe. No he preparado ningún cambio.`;
        return { modelResult: { ok: false, reason: "already_exists", classroomId: existing.id }, summary, exactResponse: summary, agentId: "classroom-agent", topic: "classrooms" };
      }
      const pendingAction = await proposeAction({ type: "create_classroom", ...input });
      const summary = `He preparado la creación de la clase ${input.name}, curso ${input.academicYear}, etapa ${input.educationalStage}. Aún no se ha guardado. Revisa y confirma la propuesta.`;
      return { modelResult: { ok: true, pendingActionId: pendingAction.id, proposal: input }, summary, exactResponse: summary, pendingAction, agentId: "classroom-agent", topic: "classrooms" };
    },
  },
  {
    name: "propose_create_student",
    description: "Prepara el alta de un alumno en una clase existente. Requiere nombre, apellidos y referencia de clase. No guarda hasta confirmación.",
    schema: createStudentInput,
    async execute(raw) {
      await requireAgentRunning("student-agent");
      const input = createStudentInput.parse(raw);
      const resolved = await resolveOneClassroom(input.classroomReference);
      if (!resolved.classroom) {
        const summary = resolved.matches.length ? `Hay varias clases posibles: ${resolved.matches.map((item) => item.name).join(", ")}. Pide que concrete una.` : `No existe una clase que coincida con «${input.classroomReference}».`;
        return { modelResult: { ok: false, reason: "classroom_not_unique", candidates: resolved.matches.map((item) => item.name) }, summary, exactResponse: summary, agentId: "student-agent", topic: "students" };
      }
      const pendingAction = await proposeAction({ type: "create_student", firstName: input.firstName, lastName: input.lastName, classroomId: resolved.classroom.id });
      const summary = `He preparado el alta de ${input.firstName} ${input.lastName} en ${resolved.classroom.name}. Aún no se ha guardado. Revisa y confirma la propuesta.`;
      return { modelResult: { ok: true, pendingActionId: pendingAction.id, student: `${input.firstName} ${input.lastName}`, classroom: resolved.classroom.name }, summary, exactResponse: summary, pendingAction, agentId: "student-agent", topic: "students" };
    },
  },
  {
    name: "propose_create_students_bulk",
    description: "Prepara el alta conjunta de dos o más alumnos en una clase existente. Extrae todos los nombres mencionados y conserva todos sus apellidos. No guarda nada hasta confirmación.",
    schema: createStudentsBulkInput,
    async execute(raw) {
      await requireAgentRunning("student-agent");
      const input = createStudentsBulkInput.parse(raw);
      const resolved = await resolveOneClassroom(input.classroomReference);
      if (!resolved.classroom) {
        const summary = resolved.matches.length ? `Hay varias clases posibles: ${resolved.matches.map((item) => item.name).join(", ")}. Indica una sola.` : `No existe una clase que coincida con «${input.classroomReference}».`;
        return { modelResult: { ok: false, reason: "classroom_not_unique", candidates: resolved.matches.map((item) => item.name) }, summary, exactResponse: summary, agentId: "student-agent", topic: "students" };
      }
      await validateStudentBatch(resolved.classroom.id, input.students);
      const pendingAction = await proposeAction({ type: "create_students_bulk", classroomId: resolved.classroom.id, students: input.students });
      const names = input.students.map((item) => `${item.firstName} ${item.lastName}`);
      const summary = `He preparado el alta de ${names.length} alumnos en ${resolved.classroom.name}:\n${names.map((name) => `- ${name}`).join("\n")}\n\nAún no se ha guardado. Revisa la lista y confirma la propuesta.`;
      return { modelResult: { ok: true, pendingActionId: pendingAction.id, classroom: resolved.classroom.name, students: names }, summary, exactResponse: summary, pendingAction, agentId: "student-agent", topic: "students" };
    },
  },
  {
    name: "propose_create_teaching_schedule",
    description: "Prepara en bloque las clases, asignaturas y franjas semanales que imparte la profesora. Úsala cuando describa qué clases tiene y cuándo. Cada combinación día/hora debe ser una entrada; si menciona varios días, crea una por día. Requiere curso académico y horas de inicio y fin explícitas. No guarda hasta confirmación.",
    schema: createTeachingScheduleInput,
    async execute(raw) {
      await requireAgentRunning("planning-agent");
      const input = createTeachingScheduleInput.parse(raw);
      const schedule = await validateTeachingSchedule(input);
      const pendingAction = await proposeAction({ type: "create_teaching_schedule", ...schedule });
      const days = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
      const summary = `He preparado ${schedule.entries.length} franjas para el curso ${schedule.academicYear}:\n${schedule.entries.map((entry) => `- ${days[entry.dayOfWeek]}, ${minuteLabel(entry.startMinute)}–${minuteLabel(entry.endMinute)} · ${entry.subjectName} · ${entry.classroomName}${entry.room ? ` · ${entry.room}` : ""}`).join("\n")}\n\nTambién se crearán las clases y asignaturas que no existan. Aún no se ha guardado. Revisa y confirma la propuesta.`;
      return { modelResult: { ok: true, pendingActionId: pendingAction.id, proposal: schedule }, summary, exactResponse: summary, pendingAction, agentId: "planning-agent", topic: "planning", artifact: { type: "planning", data: schedule } };
    },
  },
  {
    name: "propose_record_observation",
    description: "Prepara una observación docente cuando la profesora afirma un hecho concreto sobre uno o dos alumnos ya existentes, aunque no diga explícitamente 'registra'. El contenido debe proceder literalmente de la profesora. No guarda hasta confirmación.",
    schema: observationInput,
    async execute(raw) {
      await requireAgentRunning("student-agent");
      const input = observationInput.parse(raw);
      const students = [] as Array<Awaited<ReturnType<typeof resolveStudents>>[number]>;
      for (const reference of input.studentReferences) {
        const resolved = await resolveOneStudent(reference);
        if (!resolved.student) return studentResolutionFailure(reference, resolved.matches);
        if (!students.some((student) => student.id === resolved.student!.id)) students.push(resolved.student);
      }
      if (input.relationshipType !== "none" && students.length !== 2) {
        const summary = "Para registrar una relación necesito identificar exactamente a dos alumnos.";
        return { modelResult: { ok: false, reason: "relationship_requires_two_students" }, summary, exactResponse: summary, agentId: "student-agent", topic: "observations" };
      }
      const relationship = input.relationshipType === "none" ? undefined : {
        studentAId: students[0].id,
        studentBId: students[1].id,
        relationshipType: input.relationshipType,
        description: input.content,
        deactivateTypes: input.relationshipType === "works_well" ? ["avoid_adjacent"] : [],
      };
      const pendingAction = await proposeAction({ type: "record_observation", studentIds: relationship ? students.map((student) => student.id) : [students[0].id], content: input.content, category: input.category, observedAt: new Date().toISOString(), relationship });
      const names = students.map((student) => `${student.firstName} ${student.lastName}`).join(" y ");
      const summary = `He preparado una observación para ${names}: “${input.content}”. Aún no se ha guardado. Revisa y confirma la propuesta.`;
      return { modelResult: { ok: true, pendingActionId: pendingAction.id, students: names, content: input.content }, summary, exactResponse: summary, pendingAction, agentId: "student-agent", topic: "observations", activeStudentIds: students.map((student) => student.id) };
    },
  },
  {
    name: "propose_tutoring",
    description: "Prepara una tutoría familiar para un alumno usando únicamente hechos registrados. No la guarda hasta confirmación.",
    schema: studentReferenceInput,
    async execute(raw) {
      await requireAgentRunning("tutoring-agent");
      const input = studentReferenceInput.parse(raw);
      const resolved = await resolveOneStudent(input.studentReference);
      if (!resolved.student) return studentResolutionFailure(input.studentReference, resolved.matches);
      const draft = await prepareTutoring(resolved.student.id);
      const pendingAction = await proposeAction({ type: "save_tutoring", studentId: resolved.student.id, preparation: draft.preparation });
      const summary = `${draft.preparation}\n\nHe preparado el borrador, pero todavía no lo he guardado. Confirma la propuesta si quieres conservarlo.`;
      return { modelResult: { ok: true, pendingActionId: pendingAction.id, student: `${resolved.student.firstName} ${resolved.student.lastName}`, preparation: draft.preparation }, summary, exactResponse: summary, pendingAction, agentId: "tutoring-agent", topic: "tutoring", activeStudentIds: [resolved.student.id], artifact: { type: "tutoring", data: { preparation: draft.preparation, source: draft.source } } };
    },
  },
  {
    name: "propose_seating_layout",
    description: "Calcula y prepara una distribución de asientos para una clase existente, respetando restricciones confirmadas. La clase es opcional: llama igualmente a la herramienta si no se indicó y el servicio resolverá la única clase con alumnado o comunicará la ambigüedad. No guarda hasta confirmación.",
    schema: seatingInput,
    async execute(raw) {
      await requireAgentRunning("classroom-agent");
      const input = seatingInput.parse(raw);
      const resolved = await resolveOneClassroom(input.classroomReference, input.studentCount);
      if (!resolved.classroom) {
        const summary = resolved.matches.length ? `Indica para cuál de estas clases preparo la distribución: ${resolved.matches.map((item) => item.name).join(", ")}.` : `No encuentro la clase «${input.classroomReference}».`;
        return { modelResult: { ok: false, reason: "classroom_not_unique", candidates: resolved.matches.map((item) => item.name) }, summary, exactResponse: summary, agentId: "classroom-agent", topic: "seating" };
      }
      const calculated = await calculateClassroomLayout(resolved.classroom.id, input.rows, input.columns);
      if (!calculated.result.ok) return { modelResult: { ok: false, reason: calculated.result.explanation }, summary: calculated.result.explanation, exactResponse: calculated.result.explanation, agentId: "classroom-agent", topic: "seating" };
      const name = `Propuesta ${new Date().toLocaleString("es-ES")}`;
      const pendingAction = await proposeAction({ type: "save_layout", classroomId: resolved.classroom.id, name, rows: input.rows, columns: input.columns, configuration: JSON.stringify({ constraints: calculated.constraints, score: calculated.result.score, explanation: calculated.result.explanation }), assignments: calculated.result.assignments });
      const names = new Map(calculated.students.map((student) => [student.id, student.name]));
      const summary = `He generado una distribución ${input.rows}×${input.columns} para ${calculated.classroom.name}. ${calculated.result.explanation}\n\n${calculated.result.assignments.map((item) => `Fila ${item.row + 1}, asiento ${item.column + 1}: ${names.get(item.studentId)}`).join("\n")}\n\nConfirma para guardarla y poder editarla visualmente.`;
      return { modelResult: { ok: true, pendingActionId: pendingAction.id, classroom: calculated.classroom.name, rows: input.rows, columns: input.columns, score: calculated.result.score, assignments: calculated.result.assignments.map((item) => ({ ...item, student: names.get(item.studentId) })) }, summary, exactResponse: summary, pendingAction, agentId: "classroom-agent", topic: "seating", artifact: { type: "layout", data: { ...calculated.result, students: calculated.students, rows: input.rows, columns: input.columns } } };
    },
  },
  {
    name: "propose_agent_control",
    description: "Prepara iniciar, detener o reiniciar un agente interno. No aplica el cambio hasta confirmación.",
    schema: controlAgentInput,
    async execute(raw) {
      const input = controlAgentInput.parse(raw);
      const query = normalize(input.agentReference);
      const matches = agentDefinitions.filter((agent) => normalize(`${agent.id} ${agent.name}`).includes(query) || query.includes(normalize(agent.name)));
      if (matches.length !== 1) {
        const summary = matches.length ? `Hay varios agentes posibles: ${matches.map((item) => item.name).join(", ")}.` : `No existe un agente que coincida con «${input.agentReference}».`;
        return { modelResult: { ok: false, reason: "agent_not_unique", candidates: matches.map((item) => item.name) }, summary, exactResponse: summary, agentId: "alfred-orchestrator", topic: "general" };
      }
      const pendingAction = await proposeAction({ type: "control_agent", agentId: matches[0].id, action: input.action });
      const verb = input.action === "start" ? "iniciar" : input.action === "stop" ? "detener" : "reiniciar";
      const summary = `He preparado la acción para ${verb} ${matches[0].name}. Aún no se ha aplicado. Revisa y confirma la propuesta.`;
      return { modelResult: { ok: true, pendingActionId: pendingAction.id, agent: matches[0].name, action: input.action }, summary, exactResponse: summary, pendingAction, agentId: "alfred-orchestrator", topic: "general" };
    },
  },
];

const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

function ownerAgentForTool(name: string) {
  if (["search_students", "propose_create_student", "propose_create_students_bulk", "propose_record_observation"].includes(name)) return "student-agent";
  if (["get_student_profile", "get_student_observations", "get_food_safety", "get_student_relationships"].includes(name)) return "memory-agent";
  if (["list_classrooms", "propose_create_classroom", "propose_seating_layout"].includes(name)) return "classroom-agent";
  if (["get_planning", "propose_create_teaching_schedule"].includes(name)) return "planning-agent";
  if (name === "get_curriculum") return "curriculum-agent";
  if (name === "propose_tutoring") return "tutoring-agent";
  return "alfred-orchestrator";
}

function toolJsonSchema(schema: ToolSchema): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown> & {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  delete json.$schema;
  if (json.required && json.properties) {
    json.required = json.required.filter((name) => !("default" in (json.properties?.[name] ?? {})));
    if (!json.required.length) delete json.required;
  }
  return json;
}

export const alfredToolDefinitions: LlmToolDefinition[] = tools.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: toolJsonSchema(tool.schema),
  },
}));

export async function executeAlfredTool(name: string, input: Record<string, unknown>, context?: InternalA2AContext) {
  const tool = toolMap.get(name);
  if (!tool) {
    return {
      modelResult: { ok: false, reason: "unknown_tool", tool: name },
      summary: "La herramienta solicitada no existe.",
      exactResponse: "No puedo ejecutar esa operación porque no está registrada.",
      agentId: "alfred-orchestrator",
      topic: "general",
    } satisfies AlfredToolResult;
  }
  try {
    const execute = () => tool.execute(input);
    const ownerAgentId = ownerAgentForTool(name);
    if (!context || ownerAgentId === "alfred-orchestrator") return await execute();
    return await dispatchInternalA2A(context, {
      fromAgentId: "alfred-orchestrator",
      toAgentId: ownerAgentId,
      capability: name,
      arguments: input,
    }, execute);
  } catch (error) {
    const summary = error instanceof z.ZodError
      ? "Faltan datos o alguno tiene un formato inválido. Pide únicamente la información necesaria para completar la operación."
      : error instanceof Error ? error.message : "No se pudo ejecutar la herramienta.";
    return { modelResult: { ok: false, reason: "tool_error", detail: summary }, summary, agentId: "alfred-orchestrator", topic: "general" } satisfies AlfredToolResult;
  }
}
