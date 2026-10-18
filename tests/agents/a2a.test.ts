import { describe, expect, it, vi } from "vitest";
import { getA2AAgentCard, sendA2AMessage } from "@/services/a2a-service";

describe("A2A adapter", () => {
  it("publishes a local A2A 1.0 agent card", () => {
    const card = getA2AAgentCard();
    expect(card.name).toBe("Alfred");
    expect(card.supportedInterfaces).toEqual([expect.objectContaining({
      url: "http://127.0.0.1:3000/api/a2a",
      protocolBinding: "HTTP+JSON",
      protocolVersion: "1.0",
    })]);
    expect(card.capabilities.streaming).toBe(false);
    expect(card.skills.map((skill) => skill.id)).toContain("student-memory");
  });

  it("maps contextId to an Alfred conversation and exposes pending confirmation", async () => {
    const handler = vi.fn().mockResolvedValue({
      conversationId: "conversation-1",
      message: { id: "answer-1", content: "He preparado la propuesta." },
      pendingAction: { id: "action-1", operation: "record_observation", status: "pending" },
      artifact: null,
    });
    const response = await sendA2AMessage({
      message: {
        messageId: "request-1",
        contextId: "conversation-1",
        role: "ROLE_USER",
        parts: [{ text: "Lucas participa mucho" }],
      },
    }, handler);

    expect(handler).toHaveBeenCalledWith({ conversationId: "conversation-1", message: "Lucas participa mucho" });
    expect(response.message).toEqual(expect.objectContaining({
      contextId: "conversation-1",
      role: "ROLE_AGENT",
      parts: [
        { text: "He preparado la propuesta." },
        { data: expect.objectContaining({ kind: "pending_action", confirmationRequired: true }) },
      ],
    }));
  });

  it("rejects task continuation because persistent A2A tasks are not advertised", async () => {
    await expect(sendA2AMessage({
      message: {
        messageId: "request-2",
        taskId: "task-unknown",
        role: "ROLE_USER",
        parts: [{ text: "Continúa" }],
      },
    }, vi.fn())).rejects.toThrow(/no anuncia tareas A2A persistentes/i);
  });
});
