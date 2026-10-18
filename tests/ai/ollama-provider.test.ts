import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { OllamaProvider } from "@/ai/providers/ollama-provider";

describe("OllamaProvider", () => {
  afterEach(() => vi.restoreAllMocks());

  it("accepts a loopback endpoint", () => {
    expect(() => new OllamaProvider({ baseUrl: "http://localhost:11434", model: "test" })).not.toThrow();
  });

  it("cannot be configured with a cloud endpoint", () => {
    expect(() => new OllamaProvider({ baseUrl: "https://api.example.com", model: "test" })).toThrow(
      /loopback/,
    );
  });

  it("uses Ollama chat messages and returns only the assistant content", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      model: "test",
      message: { role: "assistant", content: "Respuesta limpia" },
      done: true,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "test" });

    await expect(provider.generate("Hola", { system: "Responde en español." })).resolves.toEqual({
      content: "Respuesta limpia",
      model: "test",
      done: true,
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:11434/api/chat", expect.objectContaining({
      body: expect.any(String),
    }));
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
      think: boolean;
    };
    expect(request.messages).toEqual([
      { role: "system", content: "Responde en español." },
      { role: "user", content: "Hola" },
    ]);
    expect(request.think).toBe(false);
  });

  it("falls back to prompt-constrained JSON when the local runner lacks structured decoding", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "structured output is unavailable" }), {
        status: 501,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: "test",
        message: { role: "assistant", content: '{"status":"ok"}' },
        done: true,
      }), { status: 200, headers: { "content-type": "application/json" } }));
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "test" });

    const result = await provider.generateStructured("Devuelve el estado.", z.object({
      status: z.literal("ok"),
    }));

    expect(result).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retry = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { format?: unknown };
    expect(retry.format).toBeUndefined();
  });

  it("parses native tool calls from Ollama chat", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      model: "test",
      message: {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "call-1", function: { name: "search_students", arguments: { nameStartsWith: "E" } } }],
      },
      done: true,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "test" });

    const response = await provider.chat(
      [{ role: "user", content: "¿Quién empieza por E?" }],
      [{ type: "function", function: { name: "search_students", description: "Busca alumnos", parameters: { type: "object" } } }],
    );

    expect(response.message.toolCalls).toEqual([{
      id: "call-1",
      function: { name: "search_students", arguments: { nameStartsWith: "E" } },
    }]);
  });
});
