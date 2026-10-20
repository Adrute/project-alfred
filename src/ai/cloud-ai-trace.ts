export interface CloudAiTraceContext {
  conversationId?: string;
  operation?: string;
  agentId?: string;
}

export interface CloudAiTraceStart {
  context: CloudAiTraceContext;
  provider: string;
  endpoint: string;
  model: string;
  requestBody: Record<string, unknown>;
  startedAt: Date;
}

export interface CloudAiTraceCompletion {
  responseBody: Record<string, unknown>;
  responseId?: string;
  requestId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs: number;
  finishedAt: Date;
}

export interface CloudAiTraceFailure {
  requestId?: string;
  errorCode?: string;
  errorMessage: string;
  durationMs: number;
  finishedAt: Date;
}

export interface CloudAiTraceSink {
  start(input: CloudAiTraceStart): Promise<string>;
  complete(traceId: string, input: CloudAiTraceCompletion): Promise<void>;
  fail(traceId: string, input: CloudAiTraceFailure): Promise<void>;
}
