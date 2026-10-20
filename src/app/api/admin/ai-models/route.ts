import { NextResponse } from "next/server";
import { getChatGptModelCatalog } from "@/services/chatgpt-auth-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getChatGptModelCatalog(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar el catálogo de modelos." }, { status: 500 });
  }
}
