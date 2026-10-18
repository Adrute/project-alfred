import { createAgentRegistry } from "@/agents/definitions";
import { OllamaProvider } from "@/ai/providers/ollama-provider";
import { loadConfig } from "@/config/env";
import { database } from "@/lib/database";

export interface FoundationStatus {
  database: { available: boolean; classrooms: number; students: number; detail: string };
  ollama: { available: boolean; detail: string; model: string; demoMode: boolean };
  agents: { count: number; names: string[] };
  privacy: { host: string; outboundPolicy: string };
}

export async function getFoundationStatus(): Promise<FoundationStatus> {
  const config = loadConfig();
  const registry = createAgentRegistry();
  const provider = new OllamaProvider({
    baseUrl: config.OLLAMA_BASE_URL,
    model: config.OLLAMA_MODEL,
  });

  const [ollama, databaseStatus] = await Promise.all([
    provider.health(),
    Promise.all([database.classroom.count(), database.student.count()])
      .then(([classrooms, students]) => ({
        available: true,
        classrooms,
        students,
        detail: "SQLite conectado mediante Prisma.",
      }))
      .catch(() => ({
        available: false,
        classrooms: 0,
        students: 0,
        detail: "SQLite no está inicializado. Ejecuta npm run db:migrate.",
      })),
  ]);

  return {
    database: databaseStatus,
    ollama: { ...ollama, model: config.OLLAMA_MODEL, demoMode: config.OLLAMA_DEMO_MODE },
    agents: {
      count: registry.list().length,
      names: registry.list().map((agent) => agent.name),
    },
    privacy: {
      host: config.HOST,
      outboundPolicy: "Solo Ollama en loopback; sin proveedores cloud ni telemetría.",
    },
  };
}
