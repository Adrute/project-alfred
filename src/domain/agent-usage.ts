export interface AgentTokenTrace {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface AgentTokenUsage {
  requests: number;
  measuredRequests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  averageTokensPerRequest: number;
}

export function summarizeAgentTokenUsage(traces: AgentTokenTrace[]): AgentTokenUsage {
  const measured = traces.filter((trace) => trace.totalTokens !== null);
  const totalTokens = measured.reduce((sum, trace) => sum + (trace.totalTokens ?? 0), 0);
  return {
    requests: traces.length,
    measuredRequests: measured.length,
    inputTokens: traces.reduce((sum, trace) => sum + (trace.inputTokens ?? 0), 0),
    outputTokens: traces.reduce((sum, trace) => sum + (trace.outputTokens ?? 0), 0),
    totalTokens,
    averageTokensPerRequest: measured.length ? Math.round(totalTokens / measured.length) : 0,
  };
}
