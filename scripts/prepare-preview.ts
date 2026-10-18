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

console.info("Trazas A2A ficticias preparadas para la galería.");
await database.$disconnect();
