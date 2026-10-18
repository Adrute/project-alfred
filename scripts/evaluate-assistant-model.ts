import "dotenv/config";
import { OllamaProvider } from "../src/ai/providers/ollama-provider";
import { alfredToolDefinitions } from "../src/agents/alfred-tools";
import { loadConfig } from "../src/config/env";
import { conversationContextStateSchema } from "../src/services/conversation-context-service";
import { buildAlfredSystemPrompt } from "../src/services/alfred-agent-service";

const scenarios: Array<{ message: string; expectedTool: string | null }> = [
  { message: "¿Cuántos alumnos tengo registrados?", expectedTool: "search_students" },
  { message: "Dime quiénes tienen un nombre que comienza por A", expectedTool: "search_students" },
  { message: "¿Qué sabes de Alicia Ríos?", expectedTool: "get_student_profile" },
  { message: "¿Hay alergias alimentarias registradas para preparar una excursión?", expectedTool: "get_food_safety" },
  { message: "¿Qué clases tengo mañana?", expectedTool: "get_planning" },
  { message: "¿Cómo va el currículo de 2.º ESO C?", expectedTool: "get_curriculum" },
  { message: "Lucas participa mucho en clase", expectedTool: "propose_record_observation" },
  { message: "Prepárame una tutoría con la familia de Lucas", expectedTool: "propose_tutoring" },
  { message: "Organiza los 25 alumnos en cinco filas de cinco", expectedTool: "propose_seating_layout" },
  { message: "Crea la clase 1.º ESO B para 2026-2027, etapa ESO", expectedTool: "propose_create_classroom" },
  { message: "Añade a Nuria Alba, Sergio Montes y Laura Vidal a 2.º ESO C", expectedTool: "propose_create_students_bulk" },
  { message: "Durante 2027-2028 tengo Música con 4.º ESO A los lunes y miércoles de 8:00 a 9:00", expectedTool: "propose_create_teaching_schedule" },
  { message: "Muéstrame el estado y las estadísticas de los agentes", expectedTool: "get_agent_dashboard" },
  { message: "Quiero añadir una clase nueva", expectedTool: null },
  { message: "Ayúdame a redactar un saludo amable para las familias", expectedTool: null },
];

const config = loadConfig();
const provider = new OllamaProvider({
  baseUrl: config.OLLAMA_BASE_URL,
  model: config.OLLAMA_MODEL,
  timeoutMs: 120_000,
});
const state = conversationContextStateSchema.parse({});
let passed = 0;

for (const scenario of scenarios) {
  const response = await provider.chat([
    { role: "system", content: buildAlfredSystemPrompt(state) },
    { role: "user", content: scenario.message },
  ], alfredToolDefinitions, { temperature: 0, contextLength: config.OLLAMA_CONTEXT_LENGTH });
  const actualTool = response.message.toolCalls?.[0]?.function.name ?? null;
  const ok = actualTool === scenario.expectedTool;
  if (ok) passed += 1;
  console.info(`${ok ? "✓" : "✗"} ${scenario.message} -> ${actualTool ?? "respuesta"} (esperado: ${scenario.expectedTool ?? "respuesta"})`);
}

console.info(`Resultado: ${passed}/${scenarios.length} decisiones nativas correctas.`);
if (passed !== scenarios.length) process.exitCode = 1;
