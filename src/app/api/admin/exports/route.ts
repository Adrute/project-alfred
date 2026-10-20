import { NextResponse } from "next/server";
import { exportRequestSchema } from "@/domain/data-export";
import { createDataExport, getExportCatalog } from "@/services/data-export-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ datasets: getExportCatalog() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const input = exportRequestSchema.parse(await request.json());
    const result = await createDataExport(input);
    return new Response(result.content, {
      headers: {
        "content-type": result.contentType,
        "content-disposition": `attachment; filename="${result.filename}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo generar la exportación." }, { status: 400 });
  }
}
