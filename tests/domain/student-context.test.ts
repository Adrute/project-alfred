import { describe, expect, it } from "vitest";
import { isContextualStudentReference } from "@/services/student-service";
import { hasExplicitUnresolvedName, inferConversationTopic, parseConversationContext } from "@/services/conversation-context-service";

describe("isContextualStudentReference", () => {
  it.each([
    "¿Qué sabes de él?",
    "¿Y qué observaciones tiene?",
    "¿En qué grupo está ella?",
    "Cuéntame algo más de ese alumno",
  ])("recognizes a conversational follow-up: %s", (message) => {
    expect(isContextualStudentReference(message)).toBe(true);
  });

  it.each([
    "¿Qué sabes de Pedro?",
    "Dime los nombres de todos los alumnos",
    "¿Cuántos estudiantes tengo?",
  ])("does not replace an explicit or unrelated query: %s", (message) => {
    expect(isContextualStudentReference(message)).toBe(false);
  });
});

describe("conversation context safeguards", () => {
  it("recognizes broad conversation topics without relying on a fixed sentence", () => {
    expect(inferConversationTopic("Tenemos que revisar el menú de la excursión")).toBe("food_safety");
    expect(inferConversationTopic("Prepara la reunión con su familia")).toBe("tutoring");
    expect(inferConversationTopic("¿Qué hacemos mañana en clase?")).toBe("planning");
  });

  it("does not replace a new unknown proper name with the active student", () => {
    expect(hasExplicitUnresolvedName("¿Qué sabes de Pedro?")).toBe(true);
    expect(hasExplicitUnresolvedName("¿Qué sabes de él?")).toBe(false);
  });

  it("recovers safely from malformed persisted context", () => {
    expect(parseConversationContext("not-json")).toEqual({ version: 2, activeStudentIds: [], topic: "general", lastTool: null });
  });
});
