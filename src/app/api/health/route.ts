import { NextResponse } from "next/server";
import { getFoundationStatus } from "@/services/foundation-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getFoundationStatus();
    return NextResponse.json(status, {
      status: status.database.available ? 200 : 503,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid_configuration",
        message: error instanceof Error ? error.message : "Configuración no válida",
      },
      { status: 503 },
    );
  }
}
