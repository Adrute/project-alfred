import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { getChatGptModelCatalog } from "@/services/chatgpt-auth-service";

export const dynamic = "force-dynamic";

async function handleGET() {
  try {
    return NextResponse.json(await getChatGptModelCatalog(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar el catálogo de modelos." }, { status: 500 });
  }
}

export const GET = withApiAuth(handleGET, "admin");
