import "dotenv/config";
import { database } from "../src/lib/database";
import { dispatchInternalA2A } from "../src/services/internal-a2a-service";
import { getWeekPlan } from "../src/services/planning-service";
import { listStudents } from "../src/services/student-service";

const students = await listStudents();
await dispatchInternalA2A(
  { requestId: "preview-list-students" },
  {
    fromAgentId: "alfred-orchestrator",
    toAgentId: "student-agent",
    capability: "list-students",
    arguments: { includeObservations: false },
  },
  async () => ({
    summary: `Hay ${students.length} alumnos registrados en los grupos activos.`,
    modelResult: { count: students.length, studentIds: students.map((student) => student.id) },
  }),
);

const plan = await getWeekPlan("2026-10-12");
await dispatchInternalA2A(
  { requestId: "preview-week-plan" },
  {
    fromAgentId: "alfred-orchestrator",
    toAgentId: "planning-agent",
    capability: "get-week-plan",
    arguments: { weekStart: "2026-10-12" },
  },
  async () => ({
    summary: `La semana contiene ${plan.lessons.length} sesiones docentes.`,
    modelResult: { lessonIds: plan.lessons.map((lesson) => lesson.id) },
  }),
);

const now = Date.now();
await database.cloudAiTrace.createMany({ data: [
  {
    agentId: "alfred-orchestrator", operation: "alfred_chat", model: "gpt-6.1-sol", status: "completed",
    requestBodyJson: JSON.stringify({ model: "gpt-6.1-sol", input: [{ role: "user", content: "¿Qué observaciones hay sobre ALUMNO_6F3A9182CE?" }], store: false, stream: true }),
    responseBodyJson: JSON.stringify({ id: "resp_preview_1", status: "completed", output: [{ type: "function_call", name: "student_profile", arguments: { studentQuery: "ALUMNO_6F3A9182CE" } }], usage: { input_tokens: 684, output_tokens: 42, total_tokens: 726 } }),
    responseId: "resp_preview_1", requestId: "req_preview_1", inputTokens: 684, outputTokens: 42, totalTokens: 726, durationMs: 842, studentAliasCount: 1,
    createdAt: new Date(now - 18 * 60 * 1_000), finishedAt: new Date(now - 18 * 60 * 1_000 + 842),
  },
  {
    agentId: "memory-agent", operation: "resolve_conversation_context", model: "gpt-6.1-sol", status: "completed",
    requestBodyJson: JSON.stringify({ model: "gpt-6.1-sol", input: [{ role: "user", content: "Mensaje actual: ¿Y qué sabes de él? Foco: ALUMNO_6F3A9182CE" }], store: false, stream: true }),
    responseBodyJson: JSON.stringify({ id: "resp_preview_2", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "{\"dependsOnHistory\":true}" }] }], usage: { input_tokens: 311, output_tokens: 28, total_tokens: 339 } }),
    responseId: "resp_preview_2", requestId: "req_preview_2", inputTokens: 311, outputTokens: 28, totalTokens: 339, durationMs: 531, studentAliasCount: 1,
    createdAt: new Date(now - 7 * 60 * 60 * 1_000), finishedAt: new Date(now - 7 * 60 * 60 * 1_000 + 531),
  },
  {
    agentId: "tutoring-agent", operation: "prepare_tutoring", model: "gpt-6.1-sol", status: "completed",
    requestBodyJson: JSON.stringify({ model: "gpt-6.1-sol", input: [{ role: "user", content: "Prepara una tutoría para ALUMNO_EC102D8B44 con estos hechos registrados." }], store: false, stream: true }),
    responseBodyJson: JSON.stringify({ id: "resp_preview_3", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "{\"questions\":[\"¿Qué apoyos funcionan?\"]}" }] }], usage: { input_tokens: 455, output_tokens: 96, total_tokens: 551 } }),
    responseId: "resp_preview_3", requestId: "req_preview_3", inputTokens: 455, outputTokens: 96, totalTokens: 551, durationMs: 1104, studentAliasCount: 1,
    createdAt: new Date(now - 29 * 60 * 60 * 1_000), finishedAt: new Date(now - 29 * 60 * 60 * 1_000 + 1104),
  },
] });
await database.agentRuntime.upsert({
  where: { agentId: "alfred-orchestrator" },
  update: { aiModel: null },
  create: { agentId: "alfred-orchestrator", status: "running", startedAt: new Date(), aiModel: null },
});

console.info("Trazas A2A y logs de ChatGPT ficticios preparados para la galería.");
await database.$disconnect();
