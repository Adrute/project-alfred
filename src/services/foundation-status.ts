import { createAgentRegistry } from "@/agents/definitions";
import { loadConfig } from "@/config/env";
import { database } from "@/lib/database";
import { getChatGptStatus } from "./chatgpt-auth-service";

export interface FoundationStatus {
  database: { available: boolean; classrooms: number; students: number; detail: string };
  ai: { cloudEnabled: boolean; canSignInHere: boolean; canRegisterAgain: boolean; connected: boolean; planEnabled: boolean; detail: string; model: string | null };
  agents: { count: number; names: string[] };
  privacy: { host: string; outboundPolicy: string };
}

export async function getFoundationStatus(): Promise<FoundationStatus> {
  const config = loadConfig();
  const registry = createAgentRegistry();

  const [ai, databaseStatus] = await Promise.all([
    getChatGptStatus(),
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
    ai: { cloudEnabled: ai.cloudEnabled, canSignInHere: ai.canSignInHere, canRegisterAgain: ai.canRegisterAgain, connected: ai.connected, planEnabled: ai.planEnabled, detail: ai.detail, model: ai.model },
    agents: {
      count: registry.list().length,
      names: registry.list().map((agent) => agent.name),
    },
    privacy: {
      host: config.HOST,
      outboundPolicy: "Datos locales; ChatGPT opcional con seudonimización previa de nombres y contactos.",
    },
  };
}
