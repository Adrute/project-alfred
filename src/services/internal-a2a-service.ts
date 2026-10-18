import { randomUUID } from "node:crypto";
import { database } from "@/lib/database";
import { A2A_PROTOCOL_VERSION } from "@/agents/a2a/contracts";

interface InternalAgentResult {
  summary: string;
  modelResult: Record<string, unknown>;
}

export interface InternalA2AContext {
  requestId: string;
  userConversationId?: string;
}

function safePayload(value: unknown) {
  const serialized = JSON.stringify(value);
  if (serialized.length <= 8_000) return serialized;
  return JSON.stringify({ truncated: true, preview: serialized.slice(0, 7_800) });
}

export async function dispatchInternalA2A<Result extends InternalAgentResult>(
  context: InternalA2AContext,
  input: { fromAgentId: string; toAgentId: string; capability: string; arguments: Record<string, unknown> },
  execute: () => Promise<Result>,
): Promise<Result> {
  const conversation = await database.agentConversation.upsert({
    where: { requestId: context.requestId },
    update: { status: "running", finishedAt: null },
    create: {
      requestId: context.requestId,
      userConversationId: context.userConversationId,
      title: `${input.fromAgentId} → ${input.toAgentId}`,
    },
  });
  const requestMessageId = randomUUID();
  const a2aContextId = context.userConversationId ?? context.requestId;
  const requestMessage = {
    messageId: requestMessageId,
    contextId: a2aContextId,
    taskId: context.requestId,
    role: "ROLE_USER",
    parts: [
      { text: `Ejecuta la capacidad ${input.capability}.`, mediaType: "text/plain" },
      { data: input.arguments, mediaType: "application/json" },
    ],
    metadata: { fromAgentId: input.fromAgentId, toAgentId: input.toAgentId, skillId: input.capability },
  } as const;
  await database.agentMessage.create({ data: {
    agentConversationId: conversation.id,
    protocol: A2A_PROTOCOL_VERSION,
    messageId: requestMessageId,
    fromAgentId: input.fromAgentId,
    toAgentId: input.toAgentId,
    kind: "request",
    capability: input.capability,
    content: `Solicitud estructurada para ${input.capability.replaceAll("_", " ")}.`,
    payloadJson: safePayload(requestMessage),
  }});
  try {
    const result = await execute();
    const responseMessageId = randomUUID();
    const timestamp = new Date().toISOString();
    const responseMessage = {
      messageId: responseMessageId,
      contextId: a2aContextId,
      taskId: context.requestId,
      role: "ROLE_AGENT",
      parts: [{ text: result.summary, mediaType: "text/plain" }],
      metadata: { fromAgentId: input.toAgentId, toAgentId: input.fromAgentId, skillId: input.capability },
    } as const;
    const task = {
      id: context.requestId,
      contextId: a2aContextId,
      status: { state: "TASK_STATE_COMPLETED", message: responseMessage, timestamp },
      artifacts: [{
        artifactId: randomUUID(),
        name: `${input.capability}-result`,
        parts: [{ data: result.modelResult, mediaType: "application/json" }],
      }],
      history: [requestMessage, responseMessage],
      metadata: { fromAgentId: input.fromAgentId, toAgentId: input.toAgentId, skillId: input.capability },
    } as const;
    await database.agentMessage.create({ data: {
      agentConversationId: conversation.id,
      protocol: A2A_PROTOCOL_VERSION,
      messageId: responseMessageId,
      fromAgentId: input.toAgentId,
      toAgentId: input.fromAgentId,
      kind: "response",
      capability: input.capability,
      content: result.summary.slice(0, 2_000),
      payloadJson: safePayload(task),
    }});
    await database.agentConversation.update({ where: { id: conversation.id }, data: { status: "completed", finishedAt: new Date() } });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del agente.";
    await database.agentMessage.create({ data: {
      agentConversationId: conversation.id,
      protocol: A2A_PROTOCOL_VERSION,
      messageId: randomUUID(),
      fromAgentId: input.toAgentId,
      toAgentId: input.fromAgentId,
      kind: "error",
      capability: input.capability,
      content: message.slice(0, 2_000),
      payloadJson: safePayload({
        id: context.requestId,
        contextId: a2aContextId,
        status: { state: "TASK_STATE_FAILED", timestamp: new Date().toISOString() },
        metadata: { fromAgentId: input.fromAgentId, toAgentId: input.toAgentId, skillId: input.capability },
      }),
    }});
    await database.agentConversation.update({ where: { id: conversation.id }, data: { status: "failed", finishedAt: new Date() } });
    throw error;
  }
}

export async function getInternalA2AHistory(limit = 50) {
  const conversations = await database.agentConversation.findMany({
    include: { messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  const totalMessages = await database.agentMessage.count();
  return {
    protocol: A2A_PROTOCOL_VERSION,
    totalConversations: await database.agentConversation.count(),
    totalMessages,
    conversations: conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => ({
        ...message,
        payload: JSON.parse(message.payloadJson) as unknown,
        payloadJson: undefined,
      })),
    })),
  };
}
