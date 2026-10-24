import type { Prisma } from "@/generated/prisma/client";
import { database } from "@/lib/database";

export interface CloudAiLogFilters {
  query: string;
  status: string;
  model: string;
  operation: string;
  since?: Date;
  limit: number;
}

export async function createCloudAiTrace(data: Prisma.CloudAiTraceUncheckedCreateInput) {
  return database.cloudAiTrace.create({ data });
}

export async function completeCloudAiTrace(id: string, data: Prisma.CloudAiTraceUpdateInput) {
  await database.cloudAiTrace.update({ where: { id }, data });
}

export async function failCloudAiTrace(id: string, data: Prisma.CloudAiTraceUpdateInput) {
  await database.cloudAiTrace.update({ where: { id }, data });
}

function whereFor(filters: CloudAiLogFilters): Prisma.CloudAiTraceWhereInput {
  const where: Prisma.CloudAiTraceWhereInput = {};
  if (filters.status !== "all") where.status = filters.status;
  if (filters.model !== "all") where.model = filters.model;
  if (filters.operation !== "all") where.operation = filters.operation;
  if (filters.since) where.createdAt = { gte: filters.since };
  if (filters.query) {
    where.OR = [
      { operation: { contains: filters.query } },
      { agentId: { contains: filters.query } },
      { model: { contains: filters.query } },
      { requestId: { contains: filters.query } },
      { responseId: { contains: filters.query } },
    ];
  }
  return where;
}

export async function findCloudAiLogs(filters: CloudAiLogFilters) {
  return database.cloudAiTrace.findMany({
    where: whereFor(filters),
    orderBy: { createdAt: "desc" },
    take: filters.limit,
  });
}

export async function getCloudAiLogFacets(filters: CloudAiLogFilters) {
  return database.cloudAiTrace.findMany({
    where: whereFor(filters),
    select: { status: true, durationMs: true, inputTokens: true, outputTokens: true, totalTokens: true, createdAt: true },
  });
}

export async function getCloudAiLogOptions(since?: Date) {
  const where = since ? { createdAt: { gte: since } } : {};
  const [models, operations] = await Promise.all([
    database.cloudAiTrace.groupBy({ by: ["model"], where, _count: { _all: true }, orderBy: { model: "asc" } }),
    database.cloudAiTrace.groupBy({ by: ["operation"], where, _count: { _all: true }, orderBy: { operation: "asc" } }),
  ]);
  return { models, operations };
}

export async function deleteAllCloudAiLogs() {
  return database.cloudAiTrace.deleteMany();
}
