import { z } from "zod";
import { isLoopbackUrl } from "@/config/env";
import {
  LlmUnavailableError,
  type GenerationOptions,
  type LlmChatMessage,
  type LlmChatResponse,
  type LlmProvider,
  type LlmResponse,
  type LlmToolDefinition,
} from "./llm-provider";

const ollamaResponseSchema = z.object({
  model: z.string(),
  message: z.object({
    role: z.string(),
    content: z.string(),
    thinking: z.string().optional(),
    tool_calls: z.array(z.object({
      id: z.string().optional(),
      function: z.object({
        name: z.string(),
        arguments: z.record(z.string(), z.unknown()),
      }),
    })).optional(),
  }),
  done: z.boolean(),
});

const tagsResponseSchema = z.object({
  models: z.array(z.object({ name: z.string(), model: z.string().optional() })),
});

export interface OllamaProviderOptions {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

export class OllamaProvider implements LlmProvider {
  readonly id = "ollama-local";
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: OllamaProviderOptions) {
    if (!isLoopbackUrl(options.baseUrl)) {
      throw new Error("OllamaProvider only accepts loopback URLs");
    }
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async generate(prompt: string, options: GenerationOptions = {}): Promise<LlmResponse> {
    const payload = await this.request({
      model: this.model,
      messages: this.messages(prompt, options.system),
      stream: false,
      think: false,
      options: { temperature: options.temperature ?? 0.2, num_ctx: options.contextLength },
    }, options.signal);

    const response = ollamaResponseSchema.parse(payload);
    return { content: response.message.content, model: response.model, done: response.done };
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options: GenerationOptions = {},
  ): Promise<T> {
    const jsonSchema = z.toJSONSchema(schema);
    const structuredPrompt = `${prompt}\n\nDevuelve únicamente JSON válido que cumpla exactamente este JSON Schema:\n${JSON.stringify(jsonSchema)}`;
    const body = {
      model: this.model,
      messages: this.messages(structuredPrompt, options.system),
      stream: false,
      think: false,
      options: { temperature: options.temperature ?? 0, num_predict: 1_000 },
    };

    let payload: unknown;
    try {
      payload = await this.request({ ...body, format: jsonSchema }, options.signal);
    } catch (error) {
      if (!(error instanceof LlmUnavailableError) || !error.message.includes("structured output is unavailable")) {
        throw error;
      }
      // Some local runners can execute the model but do not implement grammar-constrained
      // decoding. We still require JSON and validate it with Zod before accepting it.
      payload = await this.request(body, options.signal);
    }

    const response = ollamaResponseSchema.parse(payload);
    return schema.parse(JSON.parse(response.message.content));
  }

  async chat(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[] = [],
    options: GenerationOptions = {},
  ): Promise<LlmChatResponse> {
    const payload = await this.request({
      model: this.model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.thinking ? { thinking: message.thinking } : {}),
        ...(message.toolCalls ? { tool_calls: message.toolCalls } : {}),
        ...(message.toolName ? { tool_name: message.toolName } : {}),
      })),
      ...(tools.length ? { tools } : {}),
      stream: false,
      think: false,
      options: {
        temperature: options.temperature ?? 0,
        num_ctx: options.contextLength,
      },
    }, options.signal);
    const response = ollamaResponseSchema.parse(payload);
    const message: LlmChatMessage = {
      role: "assistant",
      content: response.message.content,
      thinking: response.message.thinking,
      toolCalls: response.message.tool_calls?.map((call) => ({
        id: call.id,
        function: call.function,
      })),
    };
    return {
      content: message.content,
      model: response.model,
      done: response.done,
      message,
    };
  }

  async health(): Promise<{ available: boolean; detail: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(Math.min(this.timeoutMs, 2_000)),
        cache: "no-store",
      });
      if (!response.ok) {
        return { available: false, detail: `Ollama respondió con HTTP ${response.status}.` };
      }

      const tags = tagsResponseSchema.parse(await response.json());
      const modelAvailable = tags.models.some(
        (item) => item.name === this.model || item.model === this.model,
      );
      return modelAvailable
        ? { available: true, detail: `Ollama y ${this.model} están disponibles.` }
        : {
            available: false,
            detail: `Ollama está activo, pero falta descargar ${this.model}.`,
          };
    } catch {
      return {
        available: false,
        detail: "Ollama no está disponible. Las funciones deterministas siguen operativas.",
      };
    }
  }

  private messages(prompt: string, system?: string) {
    return [
      ...(system ? [{ role: "system" as const, content: system }] : []),
      { role: "user" as const, content: prompt },
    ];
  }

  private async request(body: object, externalSignal?: AbortSignal): Promise<unknown> {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const signal = externalSignal
      ? AbortSignal.any([externalSignal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
        cache: "no-store",
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        throw new LlmUnavailableError(
          `Ollama respondió con HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof LlmUnavailableError) throw error;
      throw new LlmUnavailableError(
        "No se pudo conectar con Ollama local. Comprueba que el servicio esté iniciado.",
        { cause: error },
      );
    }
  }
}
