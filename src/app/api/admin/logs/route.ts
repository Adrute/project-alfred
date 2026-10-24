import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { cloudAiLogQuerySchema, deleteCloudAiLogsSchema } from "@/domain/cloud-ai-log";
import { clearCloudAiLogs, getCloudAiLogDashboard } from "@/services/cloud-ai-log-service";

export const dynamic = "force-dynamic";

async function handleGET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    const query = cloudAiLogQuerySchema.parse({
      query: search.get("query") ?? undefined,
      status: search.get("status") ?? undefined,
      model: search.get("model") ?? undefined,
      operation: search.get("operation") ?? undefined,
      range: search.get("range") ?? undefined,
      limit: search.get("limit") ?? undefined,
    });
    return NextResponse.json(await getCloudAiLogDashboard(query), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron cargar los logs de ChatGPT." }, { status: 400 });
  }
}

async function handleDELETE(request: Request) {
  try {
    const input = deleteCloudAiLogsSchema.parse(await request.json());
    const result = await clearCloudAiLogs(input.confirmation);
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron borrar los logs de ChatGPT." }, { status: 400 });
  }
}

export const GET = withApiAuth(handleGET, "admin");
export const DELETE = withApiAuth(handleDELETE, "admin");
