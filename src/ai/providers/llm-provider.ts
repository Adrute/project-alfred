import type { z } from "zod";

export interface GenerationOptions {
  temperature?: number;
  contextLength?: number;
  signal?: AbortSignal;
  system?: string;
}

export interface LlmToolCall {
  id?: string;
  function: { name: string; arguments: Record<string, unknown> };
}

export interface LlmChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  thinking?: string;
  toolCalls?: LlmToolCall[];
  toolName?: string;
}

export interface LlmToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmChatResponse extends LlmResponse {
  message: LlmChatMessage;
}

export interface LlmResponse {
  content: string;
  model: string;
  done: boolean;
}

export interface LlmProvider {
  readonly id: string;
  generate(prompt: string, options?: GenerationOptions): Promise<LlmResponse>;
  generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: GenerationOptions,
  ): Promise<T>;
  chat(
    messages: LlmChatMessage[],
    tools?: LlmToolDefinition[],
    options?: GenerationOptions,
  ): Promise<LlmChatResponse>;
  health(): Promise<{ available: boolean; detail: string }>;
}

export class LlmUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LlmUnavailableError";
  }
}
