import type { z } from "zod";

export interface AgentCapability {
  id: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  mutatesData: boolean;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: readonly AgentCapability[];
}

export interface AgentExecutionContext {
  conversationId?: string;
  requestId: string;
}

export interface AgentOperation<TInput = unknown, TOutput = unknown> {
  capabilityId: string;
  input: TInput;
  context: AgentExecutionContext;
  execute(): Promise<TOutput>;
}
