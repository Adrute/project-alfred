import { agentDefinitions } from "@/agents/definitions";
import { database } from "@/lib/database";
import { getChatGptModelCatalog } from "@/services/chatgpt-auth-service";

export async function resolveAgentAiModel(agentId: string | undefined, defaultModel: string) {
  if (!agentId) return defaultModel;
  const definition = agentDefinitions.find((agent) => agent.id === agentId);
  if (!definition?.usesAi) return defaultModel;
  const runtime = await database.agentRuntime.findUnique({ where: { agentId }, select: { aiModel: true } });
  return runtime?.aiModel ?? defaultModel;
}

export async function setAgentAiModel(agentId: string, model: string | null) {
  const definition = agentDefinitions.find((agent) => agent.id === agentId);
  if (!definition) throw new Error("No existe el agente solicitado.");
  if (!definition.usesAi) throw new Error(`${definition.name} no utiliza un modelo generativo en esta versión.`);
  if (model) {
    const catalog = await getChatGptModelCatalog();
    if (!catalog.connected) throw new Error("Conecta ChatGPT antes de seleccionar un modelo.");
    if (!catalog.models.some((candidate) => candidate.id === model)) throw new Error("El modelo seleccionado no está disponible para la cuenta conectada.");
  }
  return database.agentRuntime.upsert({
    where: { agentId },
    update: { aiModel: model },
    create: { agentId, status: "running", startedAt: new Date(), aiModel: model },
  });
}
