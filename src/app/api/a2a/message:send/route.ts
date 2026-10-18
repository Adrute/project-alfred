import { NextResponse } from "next/server";
import { z } from "zod";
import { A2A_MEDIA_TYPE, A2A_PROTOCOL_VERSION } from "@/agents/a2a/contracts";
import { sendA2AMessage } from "@/services/a2a-service";

export const dynamic = "force-dynamic";

function problem(detail: string, status: number, extras: Record<string, unknown> = {}) {
  return NextResponse.json({
    type: "about:blank",
    title: status === 400 ? "Invalid A2A request" : "A2A request failed",
    status,
    detail,
    ...extras,
  }, { status, headers: { "content-type": "application/problem+json" } });
}

export async function POST(request: Request) {
  const requestedVersion = request.headers.get("a2a-version");
  if (requestedVersion && requestedVersion !== A2A_PROTOCOL_VERSION && requestedVersion !== "1.0.0") {
    return problem(`La versión A2A ${requestedVersion} no está soportada.`, 400, {
      supportedVersions: [A2A_PROTOCOL_VERSION],
    });
  }
  try {
    const result = await sendA2AMessage(await request.json());
    return NextResponse.json(result, {
      headers: { "content-type": A2A_MEDIA_TYPE, "a2a-version": A2A_PROTOCOL_VERSION },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return problem("El mensaje A2A no tiene un formato válido.", 400);
    return problem(error instanceof Error ? error.message : "No se pudo procesar el mensaje A2A.", 400);
  }
}
