import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { getInternalA2AHistory } from "@/services/internal-a2a-service";

export const dynamic = "force-dynamic";

async function handleGET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    return NextResponse.json(await getInternalA2AHistory(Number.isFinite(limit) ? limit : 50), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar la actividad A2A." }, { status: 500 });
  }
}

export const GET = withApiAuth(handleGET, "admin");
