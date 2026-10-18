import { z } from "zod";
import { OllamaProvider } from "@/ai/providers/ollama-provider";
import { loadConfig } from "@/config/env";
import type { ChatPageContext } from "@/domain/chat";
import { getStudentsByIds, resolveStudents, resolveStudentsInConversation } from "./student-service";

export type ConversationTurn = { role: string; content: string };

const conversationTopicSchema = z.enum([
  "students",
  "observations",
  "tutoring",
  "seating",
  "food_safety",
  "planning",
  "curriculum",
  "classrooms",
  "general",
]);

export type ConversationTopic = z.infer<typeof conversationTopicSchema>;

export const conversationContextStateSchema = z.object({
  version: z.literal(2).default(2),
  activeStudentIds: z.array(z.string()).max(6).default([]),
  topic: conversationTopicSchema.default("general"),
  lastTool: z.object({
    name: z.string().min(1).max(100),
    arguments: z.record(z.string(), z.unknown()),
    result: z.record(z.string(), z.unknown()),
    summary: z.string().max(2_000),
  }).nullable().default(null),
});

const contextResolutionSchema = z.object({
  dependsOnHistory: z.boolean(),
  referencedStudentNames: z.array(z.string().min(1).max(120)).max(6),
  topic: conversationTopicSchema,
  confidence: z.enum(["high", "low"]),
});

export type ConversationContextState = z.infer<typeof conversationContextStateSchema>;

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();

export function parseConversationContext(value: string): ConversationContextState {
  try {
    return conversationContextStateSchema.parse(JSON.parse(value));
  } catch {
    return conversationContextStateSchema.parse({});
  }
}

export function serializeConversationContext(value: ConversationContextState) {
  return JSON.stringify(conversationContextStateSchema.parse(value));
}

export function inferConversationTopic(message: string): ConversationTopic {
  const text = normalize(message);
  if (/alerg|intoler|celia|menu|comida|aliment|gluten|lactos|frutos secos|cacahu|marisco/.test(text)) return "food_safety";
  if (/tutoria|familia/.test(text)) return "tutoring";
  if (/asientos?|sentar|pupitres?|distribucion del aula/.test(text)) return "seating";
  if (/observaciones?|anotaciones?|incidencias?|apunta|anota|registra/.test(text)) return "observations";
  if (/agenda|horario|planificacion|sesiones?|manana|semana/.test(text)) return "planning";
  if (/curricul|asignaturas?|unidades?|contenidos?|progreso academico/.test(text)) return "curriculum";
  if (/grupos?|clases? registradas?|matriculad/.test(text)) return "classrooms";
  if (/alumnos?|estudiantes?|quien es|que sabes|informacion|datos de|como va/.test(text)) return "students";
  return "general";
}

export function hasExplicitUnresolvedName(message: string) {
  return /\b(?:de|sobre|para|con|a)\s+[\p{Lu}ÁÉÍÓÚÜÑ][\p{L}'’-]*/u.test(message);
}

async function collectCandidateStudents(history: ConversationTurn[], state: ConversationContextState, pageContext?: ChatPageContext) {
  const candidates = new Map<string, Awaited<ReturnType<typeof resolveStudents>>[number]>();
  for (const student of await getStudentsByIds(pageContext?.studentIds ?? [])) candidates.set(student.id, student);
  for (const student of await getStudentsByIds(state.activeStudentIds)) candidates.set(student.id, student);
  for (const turn of history.slice().reverse()) {
    for (const student of await resolveStudents(turn.content)) candidates.set(student.id, student);
    if (candidates.size >= 30) break;
  }
  return [...candidates.values()];
}

function selectAllowedStudents(
  names: string[],
  candidates: Awaited<ReturnType<typeof resolveStudents>>,
) {
  const byFullName = new Map(candidates.map((student) => [normalize(`${student.firstName} ${student.lastName}`), student]));
  const firstNameCounts = new Map<string, number>();
  for (const student of candidates) {
    const firstName = normalize(student.firstName);
    firstNameCounts.set(firstName, (firstNameCounts.get(firstName) ?? 0) + 1);
  }
  const selected = new Map<string, (typeof candidates)[number]>();
  for (const name of names) {
    const normalized = normalize(name);
    const fullNameMatch = byFullName.get(normalized);
    const firstNameMatch = candidates.find((student) => normalize(student.firstName) === normalized && firstNameCounts.get(normalized) === 1);
    const match = fullNameMatch ?? firstNameMatch;
    if (match) selected.set(match.id, match);
  }
  return [...selected.values()];
}

function historyTranscript(history: ConversationTurn[]) {
  return history.slice(-12).map((turn) => `${turn.role === "user" ? "Profesora" : "Alfred"}: ${turn.content}`).join("\n");
}

function canUseSingleStudentFocus(message: string, topic: ConversationTopic) {
  const text = normalize(message);
  const studentScopedTopic = topic === "students" || topic === "observations" || topic === "tutoring" || topic === "classrooms" || topic === "general";
  const collectionRequest = /\b(?:alumnos?|estudiantes?|todos?|lista|nombres?|cuantos?|alguno mas)\b/.test(text);
  return studentScopedTopic && !collectionRequest;
}

export async function resolveConversationContext(input: {
  message: string;
  history: ConversationTurn[];
  previousState: ConversationContextState;
  pageContext?: ChatPageContext;
}) {
  const directStudents = await resolveStudents(input.message);
  const explicitTopic = inferConversationTopic(input.message);
  if (directStudents.length) {
    const state = { activeStudentIds: directStudents.map((student) => student.id), topic: explicitTopic };
    return { students: directStudents, topic: explicitTopic, source: "direct" as const, state: conversationContextStateSchema.parse(state) };
  }

  if (hasExplicitUnresolvedName(input.message)) {
    const state = conversationContextStateSchema.parse({ ...input.previousState, topic: explicitTopic });
    return { students: [], topic: explicitTopic, source: "none" as const, state };
  }

  const visibleStudents = await getStudentsByIds(input.pageContext?.studentIds ?? []);
  const candidates = await collectCandidateStudents(input.history, input.previousState, input.pageContext);
  let students: typeof candidates = [];
  let topic = explicitTopic;
  let source: "page" | "history" | "none" = "none";

  if (visibleStudents.length === 1 && canUseSingleStudentFocus(input.message, explicitTopic)) {
    students = visibleStudents;
    source = "page";
  } else if (canUseSingleStudentFocus(input.message, explicitTopic)) {
    const conversationalStudents = await resolveStudentsInConversation(input.message, input.history);
    if (conversationalStudents.length === 1) {
      students = conversationalStudents;
      source = "history";
    } else if (candidates.length === 1) {
      students = candidates;
      source = visibleStudents.some((student) => student.id === candidates[0].id) ? "page" : "history";
    }
  }

  if (!students.length && (input.history.length || candidates.length)) {
    const config = loadConfig();
    const provider = new OllamaProvider({ baseUrl: config.OLLAMA_BASE_URL, model: config.OLLAMA_MODEL, timeoutMs: 30_000 });
    try {
      const resolution = await provider.generateStructured(
        `/no_think\nHistorial exclusivo del chat actual:\n${historyTranscript(input.history) || "(sin historial)"}\n\nPantalla visible ahora: ${input.pageContext ? `${input.pageContext.label}: ${input.pageContext.summary}` : "(sin contexto de pantalla)"}.\nFoco guardado: ${input.previousState.topic}.\nAlumnos permitidos porque aparecen en este chat o en la pantalla visible: ${candidates.map((student) => `${student.firstName} ${student.lastName}`).join(", ") || "(ninguno)"}.\n\nMensaje actual: ${input.message}\n\nDetermina si el mensaje depende del historial o de la pantalla visible para completar una referencia, un sujeto omitido o el tema. Si depende, selecciona únicamente nombres exactos de la lista permitida. No inventes alumnos ni hechos. Si contiene un nombre nuevo que no está en la lista, no lo sustituyas por otro alumno. El tema debe describir la intención actual, heredándolo solo cuando sea una continuación real.`,
        contextResolutionSchema,
        {
          temperature: 0,
          system: "Resuelves contexto conversacional para Alfred. No respondes al usuario ni ejecutas acciones. Produces solo una referencia estructurada, prudente y basada en el chat actual.",
        },
      );
      const hasSingleActiveStudent = input.previousState.activeStudentIds.length === 1;
      const inheritsSingleFocus = hasSingleActiveStudent && canUseSingleStudentFocus(input.message, explicitTopic);
      if ((resolution.dependsOnHistory && (resolution.confidence === "high" || hasSingleActiveStudent)) || inheritsSingleFocus) {
        students = selectAllowedStudents(resolution.referencedStudentNames, candidates);
        if (!students.length && hasSingleActiveStudent) {
          students = candidates.filter((student) => student.id === input.previousState.activeStudentIds[0]);
        }
        if (students.length) source = visibleStudents.some((visible) => students.some((student) => student.id === visible.id)) ? "page" : "history";
      }
      topic = explicitTopic === "general" && resolution.dependsOnHistory ? resolution.topic : explicitTopic;
    } catch {
      students = await resolveStudentsInConversation(input.message, input.history);
      if (students.length) source = "history";
      if (explicitTopic === "general" && students.length) topic = input.previousState.topic;
    }
  }

  const activeStudentIds = students.length
    ? students.map((student) => student.id)
    : input.previousState.activeStudentIds;
  const state = conversationContextStateSchema.parse({ activeStudentIds, topic });
  return { students, topic, source, state };
}
