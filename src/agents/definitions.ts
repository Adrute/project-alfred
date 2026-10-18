import { z } from "zod";
import type { AgentDefinition } from "./contracts";
import { AgentRegistry } from "./registry";

const identifierInput = z.object({ id: z.string().min(1) });
const textOutput = z.object({ text: z.string() });

export const agentDefinitions: readonly AgentDefinition[] = [
  {
    id: "alfred-orchestrator",
    name: "Alfred",
    description: "Interpreta la petición y coordina agentes especializados.",
    capabilities: [
      {
        id: "orchestrate-request",
        description: "Planifica una solicitud docente sin ejecutar SQL ni herramientas libres.",
        inputSchema: z.object({ message: z.string().min(1) }),
        outputSchema: textOutput,
        mutatesData: false,
      },
    ],
  },
  {
    id: "student-agent",
    name: "StudentAgent",
    description: "Gestiona alumnos, grupos, observaciones y relaciones contextuales.",
    capabilities: [
      {
        id: "list-students",
        description: "Lista y cuenta el alumnado registrado, con su grupo y observaciones cuando se solicitan.",
        inputSchema: z.object({ includeObservations: z.boolean().default(false) }),
        outputSchema: z.object({ count: z.number().int().nonnegative(), studentIds: z.array(z.string()) }),
        mutatesData: false,
      },
      {
        id: "get-student-context",
        description: "Recupera datos estructurados de un alumno.",
        inputSchema: identifierInput,
        outputSchema: z.object({ studentId: z.string(), observations: z.array(z.string()) }),
        mutatesData: false,
      },
      {
        id: "propose-observation",
        description: "Propone una observación pendiente de confirmación.",
        inputSchema: z.object({ studentId: z.string(), content: z.string().min(1) }),
        outputSchema: z.object({ pendingActionId: z.string() }),
        mutatesData: true,
      },
      {
        id: "propose-student-creation",
        description: "Propone el alta de un alumno en una clase existente y espera confirmación.",
        inputSchema: z.object({ firstName: z.string().min(1), lastName: z.string().min(1), classroomId: z.string().min(1) }),
        outputSchema: z.object({ pendingActionId: z.string() }),
        mutatesData: true,
      },
      {
        id: "propose-bulk-student-creation",
        description: "Propone el alta atómica de varios alumnos en una clase y espera confirmación.",
        inputSchema: z.object({ classroomId: z.string().min(1), students: z.array(z.object({ firstName: z.string().min(1), lastName: z.string().min(1) })).min(2) }),
        outputSchema: z.object({ pendingActionId: z.string() }),
        mutatesData: true,
      },
    ],
  },
  {
    id: "tutoring-agent",
    name: "TutoringAgent",
    description: "Prepara tutorías a partir de hechos registrados y propuestas explícitas.",
    capabilities: [
      {
        id: "prepare-tutoring",
        description: "Genera un borrador trazable de tutoría.",
        inputSchema: identifierInput,
        outputSchema: textOutput,
        mutatesData: false,
      },
    ],
  },
  {
    id: "classroom-agent",
    name: "ClassroomAgent",
    description: "Gestiona planos mediante restricciones y un solver determinista.",
    capabilities: [
      {
        id: "list-classrooms",
        description: "Lista grupos activos y el número de alumnos matriculados.",
        inputSchema: z.object({}),
        outputSchema: z.object({ classroomIds: z.array(z.string()) }),
        mutatesData: false,
      },
      {
        id: "generate-seating-layout",
        description: "Calcula una distribución verificando primero las restricciones duras.",
        inputSchema: identifierInput,
        outputSchema: z.object({ layoutId: z.string(), score: z.number() }),
        mutatesData: true,
      },
      {
        id: "propose-classroom-creation",
        description: "Propone crear un grupo académico y espera confirmación.",
        inputSchema: z.object({ name: z.string().min(2), academicYear: z.string(), educationalStage: z.string() }),
        outputSchema: z.object({ pendingActionId: z.string() }),
        mutatesData: true,
      },
    ],
  },
  {
    id: "memory-agent",
    name: "MemoryAgent",
    description: "Recupera memoria conversacional y estructurada con trazabilidad.",
    capabilities: [
      {
        id: "search-memory",
        description: "Busca hechos persistidos sin convertir el chat en fuente de verdad.",
        inputSchema: z.object({ query: z.string().min(1) }),
        outputSchema: z.object({ results: z.array(textOutput) }),
        mutatesData: false,
      },
    ],
  },
  {
    id: "planning-agent",
    name: "PlanningAgent",
    description: "Gestiona horarios recurrentes, sesiones concretas, excepciones y reprogramaciones.",
    capabilities: [
      {
        id: "generate-week-sessions",
        description: "Materializa sin duplicados las sesiones de una semana a partir del horario recurrente.",
        inputSchema: z.object({ weekStart: z.string().date() }),
        outputSchema: z.object({ created: z.number().int().nonnegative() }),
        mutatesData: true,
      },
      {
        id: "get-week-plan",
        description: "Recupera la agenda docente y el estado de planificación de una semana.",
        inputSchema: z.object({ weekStart: z.string().date() }),
        outputSchema: z.object({ lessonIds: z.array(z.string()) }),
        mutatesData: false,
      },
      {
        id: "detect-schedule-conflicts",
        description: "Valida solapamientos antes de guardar una franja.",
        inputSchema: z.object({ dayOfWeek: z.number().int().min(1).max(7), startMinute: z.number().int(), endMinute: z.number().int() }),
        outputSchema: z.object({ conflict: z.boolean() }),
        mutatesData: false,
      },
      {
        id: "propose-teaching-schedule",
        description: "Propone crear en bloque grupos, asignaturas y franjas recurrentes desde lenguaje natural.",
        inputSchema: z.object({ academicYear: z.string(), entries: z.array(z.object({ classroomName: z.string(), subjectName: z.string(), dayOfWeek: z.number(), startMinute: z.number(), endMinute: z.number() })).min(1) }),
        outputSchema: z.object({ pendingActionId: z.string() }),
        mutatesData: true,
      },
    ],
  },
  {
    id: "curriculum-agent",
    name: "CurriculumAgent",
    description: "Gestiona asignaturas, unidades, contenidos y progreso académico confirmado.",
    capabilities: [
      {
        id: "get-curriculum-progress",
        description: "Calcula contenidos completados y pendientes desde datos estructurados.",
        inputSchema: identifierInput,
        outputSchema: z.object({ completed: z.number().int(), pending: z.number().int() }),
        mutatesData: false,
      },
      {
        id: "propose-lesson-activities",
        description: "Propone actividades estructuradas ajustadas a la duración de una sesión.",
        inputSchema: identifierInput,
        outputSchema: z.object({ pendingActionId: z.string() }),
        mutatesData: true,
      },
    ],
  },
] as const;

export function createAgentRegistry(): AgentRegistry {
  const registry = new AgentRegistry();
  for (const agent of agentDefinitions) registry.register(agent);
  return registry;
}
