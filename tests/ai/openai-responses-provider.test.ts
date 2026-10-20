import { describe, expect, it, vi } from "vitest";
import { OpenAiResponsesProvider } from "@/ai/providers/openai-responses-provider";
import type { CloudAiTraceSink } from "@/ai/cloud-ai-trace";

function eventStream(events: unknown[]) {
  const payload = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  return new Response(payload, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("OpenAiResponsesProvider", () => {
  it("uses the ChatGPT OAuth token with non-persistent streaming Responses requests", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(eventStream([
      { type: "response.output_text.delta", delta: "Respuesta final" },
      { type: "response.completed", response: { output: [] } },
    ]));
    const provider = new OpenAiResponsesProvider({ accessToken: "secret-oauth-token", model: "gpt-test", fetchImplementation: fetchMock });

    await expect(provider.generate("Hola", { system: "Responde en español" })).resolves.toEqual({
      content: "Respuesta final",
      model: "gpt-test",
      done: true,
    });
    const [url, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(request?.headers).toMatchObject({ authorization: "Bearer secret-oauth-token" });
    expect(body).toMatchObject({ store: false, stream: true, model: "gpt-test", instructions: "Responde en español" });
    expect(JSON.stringify(body)).not.toContain('"role":"system"');
  });

  it("parses function calls and returns their call id", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(eventStream([
      { type: "response.output_item.done", item: { type: "function_call", call_id: "call-1", name: "search_students", arguments: '{"nameStartsWith":"E"}' } },
      { type: "response.completed", response: { output: [] } },
    ]));
    const provider = new OpenAiResponsesProvider({ accessToken: "token", model: "gpt-test", fetchImplementation: fetchMock });

    const response = await provider.chat(
      [{ role: "system", content: "Usa herramientas" }, { role: "user", content: "Busca alumnos" }],
      [{ type: "function", function: { name: "search_students", description: "Busca", parameters: { type: "object" } } }],
    );

    expect(response.message.toolCalls).toEqual([{ id: "call-1", function: { name: "search_students", arguments: { nameStartsWith: "E" } } }]);
  });

  it("sends tool results back as function_call_output items", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(eventStream([
      { type: "response.output_text.delta", delta: "Dos alumnos" },
      { type: "response.completed", response: { output: [] } },
    ]));
    const provider = new OpenAiResponsesProvider({ accessToken: "token", model: "gpt-test", fetchImplementation: fetchMock });
    await provider.chat([
      { role: "user", content: "Busca" },
      { role: "assistant", content: "", toolCalls: [{ id: "call-1", function: { name: "search_students", arguments: {} } }] },
      { role: "tool", content: '{"count":2}', toolCallId: "call-1", toolName: "search_students" },
    ]);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { input: unknown[] };
    expect(body.input).toContainEqual({ type: "function_call_output", call_id: "call-1", output: '{"count":2}' });
  });

  it("audits the exact request and observable completed response without credentials", async () => {
    const start = vi.fn<CloudAiTraceSink["start"]>().mockResolvedValue("trace-1");
    const complete = vi.fn<CloudAiTraceSink["complete"]>().mockResolvedValue();
    const fail = vi.fn<CloudAiTraceSink["fail"]>().mockResolvedValue();
    const traceSink: CloudAiTraceSink = { start, complete, fail };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response([
      `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Hola ALUMNO_ABCDEF1234" })}`,
      `data: ${JSON.stringify({ type: "response.completed", response: {
        id: "resp_123", object: "response", status: "completed", model: "gpt-test",
        output: [
          { type: "reasoning", summary: [{ text: "No debe persistirse" }] },
          { type: "message", role: "assistant", content: [{ type: "output_text", text: "Hola ALUMNO_ABCDEF1234" }] },
        ],
        usage: { input_tokens: 12, output_tokens: 5, total_tokens: 17 },
      } })}`,
      "",
    ].join("\n\n"), { status: 200, headers: { "content-type": "text/event-stream", "x-request-id": "req_123" } }));
    const provider = new OpenAiResponsesProvider({
      accessToken: "never-persist-this-token",
      model: "gpt-test",
      fetchImplementation: fetchMock,
      traceContext: { conversationId: "conversation-1", operation: "alfred_chat" },
      traceSink,
    });

    await provider.generate("Consulta a ALUMNO_ABCDEF1234", { system: "Responde" });

    expect(start).toHaveBeenCalledWith(expect.objectContaining({
      context: { conversationId: "conversation-1", operation: "alfred_chat" },
      model: "gpt-test",
      requestBody: expect.objectContaining({ input: [{ role: "user", content: "Consulta a ALUMNO_ABCDEF1234" }] }),
    }));
    expect(JSON.stringify(start.mock.calls[0])).not.toContain("never-persist-this-token");
    expect(complete).toHaveBeenCalledWith("trace-1", expect.objectContaining({
      responseId: "resp_123",
      requestId: "req_123",
      inputTokens: 12,
      outputTokens: 5,
      totalTokens: 17,
    }));
    expect(JSON.stringify(complete.mock.calls[0])).not.toContain("No debe persistirse");
    expect(fail).not.toHaveBeenCalled();
  });
});
