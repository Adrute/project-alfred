import type { CloudAiTraceSink } from "@/ai/cloud-ai-trace";
import type { CloudAiLogQuery } from "@/domain/cloud-ai-log";
import {
  completeCloudAiTrace,
  createCloudAiTrace,
  deleteAllCloudAiLogs,
  failCloudAiTrace,
  findCloudAiLogs,
  getCloudAiLogFacets,
  getCloudAiLogOptions,
  type CloudAiLogFilters,
} from "@/repositories/cloud-ai-log-repository";

const aliasPattern = /\bALUMNO_[A-Z0-9]{8,}\b/g;

function rangeStart(range: CloudAiLogQuery["range"], now = new Date()) {
  if (range === "all") return undefined;
  const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
  return new Date(now.getTime() - hours * 60 * 60 * 1_000);
}

function parseJson(value: string | null) {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; }
  catch { return { malformed: true }; }
}

function trimError(value: string | undefined) {
  return value?.slice(0, 2_000);
}

export const cloudAiTraceSink: CloudAiTraceSink = {
  async start(input) {
    const requestBodyJson = JSON.stringify(input.requestBody);
    const aliases = new Set(requestBodyJson.match(aliasPattern) ?? []);
    const trace = await createCloudAiTrace({
      conversationId: input.context.conversationId,
      agentId: input.context.agentId,
      provider: input.provider,
      endpoint: input.endpoint,
      operation: input.context.operation ?? "llm_request",
      model: input.model,
      status: "running",
      requestBodyJson,
      studentAliasCount: aliases.size,
      createdAt: input.startedAt,
    });
    return trace.id;
  },
  async complete(traceId, input) {
    await completeCloudAiTrace(traceId, {
      status: "completed",
      responseBodyJson: JSON.stringify(input.responseBody),
      responseId: input.responseId,
      requestId: input.requestId,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.totalTokens,
      durationMs: input.durationMs,
      finishedAt: input.finishedAt,
      errorCode: null,
      errorMessage: null,
    });
  },
  async fail(traceId, input) {
    await failCloudAiTrace(traceId, {
      status: "failed",
      requestId: input.requestId,
      errorCode: trimError(input.errorCode),
      errorMessage: trimError(input.errorMessage),
      durationMs: input.durationMs,
      finishedAt: input.finishedAt,
    });
  },
};

function histogram(logs: Array<{ createdAt: Date }>, range: CloudAiLogQuery["range"]) {
  const hourly = range === "24h";
  const counts = new Map<string, number>();
  for (const log of logs) {
    const date = new Date(log.createdAt);
    if (hourly) date.setMinutes(0, 0, 0);
    else date.setHours(0, 0, 0, 0);
    const key = date.toISOString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([at, count]) => ({ at, count }));
}

export async function getCloudAiLogDashboard(query: CloudAiLogQuery) {
  const filters: CloudAiLogFilters = {
    query: query.query,
    status: query.status,
    model: query.model,
    operation: query.operation,
    since: rangeStart(query.range),
    limit: query.limit,
  };
  const [logs, matching, options] = await Promise.all([findCloudAiLogs(filters), getCloudAiLogFacets(filters), getCloudAiLogOptions(filters.since)]);
  const completed = matching.filter((item) => item.status === "completed").length;
  const failed = matching.filter((item) => item.status === "failed").length;
  const durations = matching.flatMap((item) => item.durationMs === null ? [] : [item.durationMs]);
  const tokens = matching.reduce((sum, item) => sum + (item.totalTokens ?? 0), 0);
  return {
    summary: {
      total: matching.length,
      completed,
      failed,
      running: matching.length - completed - failed,
      successRate: completed + failed ? Math.round((completed / (completed + failed)) * 1_000) / 10 : 0,
      averageDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
      totalTokens: tokens,
    },
    filters: {
      models: options.models.map((item) => ({ value: item.model, count: item._count._all })),
      operations: options.operations.map((item) => ({ value: item.operation, count: item._count._all })),
    },
    histogram: histogram(matching, query.range),
    logs: logs.map((log) => ({
      ...log,
      requestBody: parseJson(log.requestBodyJson),
      responseBody: parseJson(log.responseBodyJson),
      requestBodyJson: undefined,
      responseBodyJson: undefined,
    })),
  };
}

export async function clearCloudAiLogs(confirmation: string) {
  if (confirmation !== "BORRAR LOGS") throw new Error("La frase de confirmación no coincide.");
  return deleteAllCloudAiLogs();
}
