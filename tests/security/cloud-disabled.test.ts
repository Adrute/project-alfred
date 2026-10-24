import { afterEach, expect, it, vi } from "vitest";
import { OpenAiResponsesProvider } from "@/ai/providers/openai-responses-provider";
import { beginChatGptSignIn, completeChatGptSignIn, disconnectChatGpt, getChatGptModelCatalog, getChatGptSession, getChatGptStatus } from "@/services/chatgpt-auth-service";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("blocks all cloud IO by default, including existing sessions and revocation", async () => {
  vi.stubEnv("CLOUD_AI_ENABLED", "false");
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  const provider = new OpenAiResponsesProvider({ accessToken: "fixture", model: "fixture", fetchImplementation: fetchMock, requestGuard: async () => undefined });
  await expect(provider.generate("Dato docente ficticio")).rejects.toMatchObject({ status: 403 });
  await expect(beginChatGptSignIn()).rejects.toMatchObject({ status: 403 });
  await expect(completeChatGptSignIn(new URLSearchParams())).rejects.toMatchObject({ status: 403 });
  await expect(disconnectChatGpt()).rejects.toMatchObject({ status: 403 });
  expect(await getChatGptSession()).toBeNull();
  expect(await getChatGptStatus()).toMatchObject({ cloudEnabled: false, connected: false, account: null });
  expect(await getChatGptModelCatalog()).toMatchObject({ models: [] });
  expect(fetchMock).not.toHaveBeenCalled();
});
