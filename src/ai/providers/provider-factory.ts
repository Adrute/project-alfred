import type { CloudAiTraceContext } from "@/ai/cloud-ai-trace";
import type { LlmProvider } from "./llm-provider";
import { OpenAiResponsesProvider } from "./openai-responses-provider";
import { getChatGptSession } from "@/services/chatgpt-auth-service";
import { cloudAiTraceSink } from "@/services/cloud-ai-log-service";
import { resolveAgentAiModel } from "@/services/agent-ai-settings-service";

export async function getConnectedLlmProvider(traceContext: CloudAiTraceContext = {}): Promise<LlmProvider | null> {
  const session = await getChatGptSession();
  if (!session) return null;
  const model = await resolveAgentAiModel(traceContext.agentId, session.model);
  return new OpenAiResponsesProvider({
    accessToken: session.accessToken,
    model,
    traceContext,
    traceSink: cloudAiTraceSink,
  });
}
