import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownMessage, plainMarkdown } from "@/components/markdown-message";

describe("MarkdownMessage", () => {
  it("renders GPT emphasis, lists and tables instead of showing raw markers", () => {
    const html = renderToStaticMarkup(createElement(MarkdownMessage, { content: [
      "Para preparar **Inglés de 2.º de ESO A**, necesito:",
      "",
      "- El **curso académico**",
      "- Los días y horas",
      "",
      "Campo | Valor",
      "--- | ---",
      "Estado | `pendiente`",
    ].join("\n") }));

    expect(html).toContain("<strong>Inglés de 2.º de ESO A</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<table>");
    expect(html).toContain("<code>pendiente</code>");
    expect(html).not.toContain("**");
  });

  it("escapes HTML supplied by the model and only creates safe HTTPS links", () => {
    const html = renderToStaticMarkup(createElement(MarkdownMessage, { content: '<script>alert("x")</script> [Ayuda](https://example.com)' }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('rel="noreferrer"');
  });

  it("creates clean one-line conversation previews", () => {
    expect(plainMarkdown("**Importante**\n- Primer paso")).toBe("Importante Primer paso");
  });
});
