import { expect, it, vi } from "vitest";
vi.mock("@/repositories/cloud-ai-log-repository", () => ({
  createCloudAiTrace: vi.fn().mockResolvedValue({ id: "fixture" }),
  completeCloudAiTrace: vi.fn(), failCloudAiTrace: vi.fn(), deleteAllCloudAiLogs: vi.fn(),
  findCloudAiLogs: vi.fn().mockResolvedValue([{ id: "historical", status: "failed", requestBodyJson: '{"name":"Alumno ficticio"}', responseBodyJson: '"Docencia privada"', errorMessage: "Contenido docente ficticio" }]),
  getCloudAiLogFacets: vi.fn().mockResolvedValue([]),
  getCloudAiLogOptions: vi.fn().mockResolvedValue({ models: [], operations: [] }),
}));
import { cloudAiTraceSink, getCloudAiLogDashboard } from "@/services/cloud-ai-log-service";
import { createCloudAiTrace, completeCloudAiTrace, failCloudAiTrace } from "@/repositories/cloud-ai-log-repository";
it("persists only trace metadata and never exposes historical bodies or error text", async () => {
  await cloudAiTraceSink.start({ context: {}, provider: "fixture", endpoint: "fixture", model: "fixture", requestBody: { instructions: "Instrucción privada", input: "Dato docente ALUMNO_ABCDEF1234" }, startedAt: new Date() });
  expect(createCloudAiTrace).toHaveBeenCalledWith(expect.objectContaining({ requestBodyJson: "{}", studentAliasCount: 1 }));
  await cloudAiTraceSink.complete("fixture", { responseBody: { content: "Respuesta privada" }, finishedAt: new Date(), durationMs: 10 });
  expect(completeCloudAiTrace).toHaveBeenCalledWith("fixture", expect.objectContaining({ responseBodyJson: null }));
  await cloudAiTraceSink.fail("fixture", { errorCode: "Dato privado", errorMessage: "Nombre del alumno", finishedAt: new Date(), durationMs: 10 });
  expect(failCloudAiTrace).toHaveBeenCalledWith("fixture", expect.objectContaining({ errorCode: "cloud_request_failed", errorMessage: null }));
  const dashboard = await getCloudAiLogDashboard({ range: "all", query: "", status: "all", model: "all", operation: "all", limit: 50 });
  const serialized = JSON.stringify(dashboard);
  expect(serialized).not.toContain("Alumno ficticio");
  expect(serialized).not.toContain("Docencia privada");
  expect(serialized).not.toContain("Contenido docente");
});
