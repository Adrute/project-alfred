import { z } from "zod";
import { agentDefinitions } from "@/agents/definitions";
import { database } from "@/lib/database";

export const agentControlSchema = z.object({
  action: z.enum(["start", "stop", "restart"]),
});

export type AgentControlAction = z.infer<typeof agentControlSchema>["action"];

async function ensureAgentRuntimes() {
  const now = new Date();
  await Promise.all(agentDefinitions.map((agent) => database.agentRuntime.upsert({
    where: { agentId: agent.id },
    update: {},
    create: { agentId: agent.id, status: "running", startedAt: now },
  })));
}

export async function requireAgentRunning(agentId: string) {
  await ensureAgentRuntimes();
  const runtime = await database.agentRuntime.findUnique({ where: { agentId } });
  if (!runtime || runtime.status !== "running") {
    const definition = agentDefinitions.find((agent) => agent.id === agentId);
    throw new Error(`${definition?.name ?? agentId} está detenido. Puedes iniciarlo desde Administración.`);
  }
}

export async function controlAgent(agentId: string, action: AgentControlAction) {
  const definition = agentDefinitions.find((agent) => agent.id === agentId);
  if (!definition) throw new Error("No existe el agente solicitado.");
  await ensureAgentRuntimes();
  const now = new Date();
  if (action === "stop") {
    return database.agentRuntime.update({ where: { agentId }, data: { status: "stopped", stoppedAt: now } });
  }
  if (action === "restart") {
    return database.agentRuntime.update({ where: { agentId }, data: {
      status: "running", startedAt: now, restartedAt: now, stoppedAt: null, restartCount: { increment: 1 },
    }});
  }
  return database.agentRuntime.update({ where: { agentId }, data: {
    status: "running", startedAt: now, stoppedAt: null,
  }});
}

export async function getAgentDashboard() {
  await ensureAgentRuntimes();
  const [runtimes, executions] = await Promise.all([
    database.agentRuntime.findMany(),
    database.agentExecution.findMany({ orderBy: { startedAt: "desc" } }),
  ]);
  const runtimeById = new Map(runtimes.map((item) => [item.agentId, item]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return agentDefinitions.map((definition) => {
    const own = executions.filter((item) => item.agentId === definition.id);
    const completed = own.filter((item) => item.status === "completed");
    const failed = own.filter((item) => item.status === "failed");
    const durations = own.flatMap((item) => item.finishedAt ? [item.finishedAt.getTime() - item.startedAt.getTime()] : []);
    const operations = Object.entries(own.reduce<Record<string, number>>((result, item) => {
      result[item.operation] = (result[item.operation] ?? 0) + 1;
      return result;
    }, {})).map(([operation, count]) => ({ operation, count })).sort((a, b) => b.count - a.count);
    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      ai: {
        usesAi: Boolean(definition.usesAi),
        configuredModel: runtimeById.get(definition.id)?.aiModel ?? null,
      },
      capabilities: definition.capabilities.map((capability) => ({
        id: capability.id,
        description: capability.description,
        mutatesData: capability.mutatesData,
      })),
      runtime: runtimeById.get(definition.id),
      statistics: {
        totalExecutions: own.length,
        executionsToday: own.filter((item) => item.startedAt >= today).length,
        completed: completed.length,
        failed: failed.length,
        successRate: own.length ? Math.round((completed.length / own.length) * 100) : 0,
        averageDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
        lastExecutionAt: own[0]?.startedAt ?? null,
        operations,
      },
      recentExecutions: own.slice(0, 10),
    };
  });
}
