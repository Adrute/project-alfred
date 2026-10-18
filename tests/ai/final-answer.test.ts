import { describe, expect, it } from "vitest";
import { sanitizeFinalAnswer } from "@/ai/final-answer";

describe("sanitizeFinalAnswer", () => {
  it("removes internal reasoning blocks", () => {
    expect(sanitizeFinalAnswer("<think>I should inspect the data.</think>La respuesta visible.")).toBe(
      "La respuesta visible.",
    );
  });

  it("keeps only the text after the last final-answer marker", () => {
    expect(sanitizeFinalAnswer("First, I should reason. Respuesta final: Solo esta respuesta.")).toBe(
      "Solo esta respuesta.",
    );
  });

  it("drops an unclosed internal block", () => {
    expect(sanitizeFinalAnswer("Respuesta útil. <analysis>Texto interno")).toBe("Respuesta útil.");
  });
});
