import { z } from "zod";
import type { CloudAiTraceContext, CloudAiTraceSink } from "@/ai/cloud-ai-trace";
import {
  LlmUnavailableError,
  type GenerationOptions,
  type LlmChatMessage,
  type LlmChatResponse,
  type LlmProvider,
  type LlmResponse,
  type LlmToolCall,
  type LlmToolDefinition,
} from "./llm-provider";

const RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";

interface OpenAiResponsesProviderOptions {
  accessToken: string;
  model: string;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
  traceContext?: CloudAiTraceContext;
  traceSink?: CloudAiTraceSink;
}

type ResponseInput =
  | { role: "user" | "assistant"; content: string }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string };

interface StreamResult {
  content: string;
  toolCalls: LlmToolCall[];
  responseBody: Record<string, unknown>;
  responseId?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

export class OpenAiResponsesProvider implements LlmProvider {
  readonly id = "openai-chatgpt";
  private readonly accessToken: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly requestFetch: typeof fetch;
  private readonly traceContext: CloudAiTraceContext;
  private readonly traceSink?: CloudAiTraceSink;

  constructor(options: OpenAiResponsesProviderOptions) {
    this.accessToken = options.accessToken;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.requestFetch = options.fetchImplementation ?? fetch;
    this.traceContext = options.traceContext ?? {};
    this.traceSink = options.traceSink;
  }

  async generate(prompt: string, options: GenerationOptions = {}): Promise<LlmResponse> {
    const result = await this.request({
      model: this.model,
      input: [{ role: "user", content: prompt }],
      ...(options.system ? { instructions: options.system } : {}),
      store: false,
      stream: true,
    }, options.signal);
    return { content: result.content, model: this.model, done: true };
  }

  async generateStructured<T>(prompt: string, schema: z.ZodType<T>, options: GenerationOptions = {}): Promise<T> {
    const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
    delete jsonSchema.$schema;
    const result = await this.request({
      model: this.model,
      input: [{ role: "user", content: prompt }],
      ...(options.system ? { instructions: options.system } : {}),
      text: {
        format: {
          type: "json_schema",
          name: "alfred_response",
          schema: jsonSchema,
          strict: true,
        },
      },
      store: false,
      stream: true,
    }, options.signal);
    try {
      return schema.parse(JSON.parse(result.content));
    } catch (error) {
      throw new LlmUnavailableError("ChatGPT devolvió una respuesta estructurada no válida.", { cause: error });
    }
  }

  async chat(
    messages: LlmChatMessage[],
    tools: LlmToolDefinition[] = [],
    options: GenerationOptions = {},
  ): Promise<LlmChatResponse> {
    const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content);
    const input: ResponseInput[] = [];
    for (const message of messages) {
      if (message.role === "system") continue;
      if (message.role === "tool") {
        if (!message.toolCallId) throw new LlmUnavailableError("Falta el identificador de la llamada de herramienta.");
        input.push({ type: "function_call_output", call_id: message.toolCallId, output: message.content });
        continue;
      }
      if (message.content) input.push({ role: message.role, content: message.content });
      for (const call of message.toolCalls ?? []) {
        const callId = call.id;
        if (!callId) throw new LlmUnavailableError("ChatGPT devolvió una herramienta sin identificador.");
        input.push({
          type: "function_call",
          call_id: callId,
          name: call.function.name,
          arguments: JSON.stringify(call.function.arguments),
        });
      }
    }
    const result = await this.request({
      model: this.model,
      input,
      ...(systemMessages.length || options.system ? { instructions: [...systemMessages, options.system].filter(Boolean).join("\n\n") } : {}),
      ...(tools.length ? {
        tools: tools.map((tool) => ({
          type: "function",
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        })),
      } : {}),
      store: false,
      stream: true,
    }, options.signal);
    const message: LlmChatMessage = {
      role: "assistant",
      content: result.content,
      toolCalls: result.toolCalls.length ? result.toolCalls : undefined,
    };
    return { content: result.content, model: this.model, done: true, message };
  }

  async health() {
    return { available: true, detail: `ChatGPT está conectado con ${this.model}.` };
  }

  private async request(body: Record<string, unknown>, externalSignal?: AbortSignal): Promise<StreamResult> {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const signal = externalSignal ? AbortSignal.any([externalSignal, timeoutSignal]) : timeoutSignal;
    const startedAt = new Date();
    let traceId: string | undefined;
    try {
      traceId = await this.traceSink?.start({
        context: this.traceContext,
        provider: this.id,
        endpoint: RESPONSES_ENDPOINT,
        model: this.model,
        requestBody: body,
        startedAt,
      });
    } catch (error) {
      throw new LlmUnavailableError("No se pudo registrar de forma segura la petición a ChatGPT.", { cause: error });
    }
    let response: Response;
    try {
      response = await this.requestFetch(RESPONSES_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          "content-type": "application/json",
          accept: "text/event-stream",
        },
        body: JSON.stringify(body),
        signal,
        cache: "no-store",
      });
    } catch (error) {
      if (traceId) await this.traceSink?.fail(traceId, {
        errorCode: "network_error",
        errorMessage: error instanceof Error ? error.message : "No se pudo conectar con ChatGPT.",
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
      throw new LlmUnavailableError("No se pudo conectar con ChatGPT.", { cause: error });
    }
    const requestId = response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined;
    if (!response.ok || !response.body) {
      const detail = (await response.text()).slice(0, 500);
      if (traceId) await this.traceSink?.fail(traceId, {
        requestId,
        errorCode: `http_${response.status}`,
        errorMessage: detail || `ChatGPT respondió con HTTP ${response.status}.`,
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
      throw new LlmUnavailableError(`ChatGPT respondió con HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    try {
      const result = await this.consumeStream(response.body);
      if (traceId) await this.traceSink?.complete(traceId, {
        responseBody: result.responseBody,
        responseId: result.responseId,
        requestId,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        totalTokens: result.usage?.totalTokens,
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
      return result;
    } catch (error) {
      if (traceId) await this.traceSink?.fail(traceId, {
        requestId,
        errorCode: "stream_error",
        errorMessage: error instanceof Error ? error.message : "La respuesta de ChatGPT no pudo procesarse.",
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
      });
      if (error instanceof LlmUnavailableError) throw error;
      throw new LlmUnavailableError("La respuesta de ChatGPT no pudo procesarse.", { cause: error });
    }
  }

  private async consumeStream(stream: ReadableStream<Uint8Array>): Promise<StreamResult> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let completed = false;
    let completedResponse: Record<string, unknown> = {};
    const calls = new Map<string, LlmToolCall>();

    const processEvent = (block: string) => {
      const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
      if (!data || data === "[DONE]") return;
      let event: Record<string, unknown>;
      try { event = JSON.parse(data) as Record<string, unknown>; } catch { return; }
      const type = typeof event.type === "string" ? event.type : "";
      if (type === "response.output_text.delta" && typeof event.delta === "string") content += event.delta;
      if (type === "response.output_item.done") this.captureToolCall(event.item, calls);
      if (type === "response.completed") {
        completed = true;
        const response = event.response as Record<string, unknown> | undefined;
        completedResponse = response ?? {};
        const output = Array.isArray(response?.output) ? response.output : [];
        for (const item of output) this.captureToolCall(item, calls);
        if (!content) content = this.completedText(output);
      }
      if (type === "response.failed" || type === "response.incomplete" || type === "error") {
        const responseError = (event.response as { error?: { code?: string; message?: string } } | undefined)?.error;
        const directError = event.error as { code?: string; message?: string } | undefined;
        const error = responseError ?? directError;
        throw new LlmUnavailableError(error?.message ?? error?.code ?? "ChatGPT no pudo completar la respuesta.");
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) processEvent(block);
      if (done) break;
    }
    if (buffer.trim()) processEvent(buffer);
    if (!completed) throw new LlmUnavailableError("La transmisión de ChatGPT terminó antes de completarse.");
    const usage = this.extractUsage(completedResponse.usage);
    return {
      content,
      toolCalls: [...calls.values()],
      responseBody: this.observableResponse(completedResponse),
      responseId: typeof completedResponse.id === "string" ? completedResponse.id : undefined,
      usage,
    };
  }

  private extractUsage(raw: unknown) {
    const usage = z.object({
      input_tokens: z.number().int().nonnegative().optional(),
      output_tokens: z.number().int().nonnegative().optional(),
      total_tokens: z.number().int().nonnegative().optional(),
    }).safeParse(raw);
    if (!usage.success) return undefined;
    return { inputTokens: usage.data.input_tokens, outputTokens: usage.data.output_tokens, totalTokens: usage.data.total_tokens };
  }

  private observableResponse(response: Record<string, unknown>) {
    const output = Array.isArray(response.output)
      ? response.output.filter((item) => !(item && typeof item === "object" && "type" in item && item.type === "reasoning"))
      : [];
    return {
      id: response.id,
      object: response.object,
      created_at: response.created_at,
      completed_at: response.completed_at,
      status: response.status,
      error: response.error,
      incomplete_details: response.incomplete_details,
      model: response.model,
      output,
      usage: response.usage,
    };
  }

  private captureToolCall(raw: unknown, calls: Map<string, LlmToolCall>) {
    const parsed = z.object({
      type: z.literal("function_call"),
      call_id: z.string().min(1),
      name: z.string().min(1),
      arguments: z.union([z.string(), z.record(z.string(), z.unknown())]),
    }).safeParse(raw);
    if (!parsed.success) return;
    try {
      const argumentsValue = typeof parsed.data.arguments === "string" ? JSON.parse(parsed.data.arguments) as unknown : parsed.data.arguments;
      const argumentsRecord = z.record(z.string(), z.unknown()).parse(argumentsValue);
      calls.set(parsed.data.call_id, { id: parsed.data.call_id, function: { name: parsed.data.name, arguments: argumentsRecord } });
    } catch (error) {
      throw new LlmUnavailableError("ChatGPT devolvió argumentos de herramienta no válidos.", { cause: error });
    }
  }

  private completedText(output: unknown[]) {
    const parts: string[] = [];
    for (const item of output) {
      const message = z.object({
        type: z.literal("message"),
        content: z.array(z.object({ type: z.string(), text: z.string().optional() })).default([]),
      }).safeParse(item);
      if (message.success) parts.push(...message.data.content.map((part) => part.text ?? ""));
    }
    return parts.join("");
  }
}
