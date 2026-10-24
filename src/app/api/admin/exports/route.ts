import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { exportRequestSchema } from "@/domain/data-export";
import { createDataExport, getExportCatalog } from "@/services/data-export-service";

export const dynamic = "force-dynamic";

async function handleGET() {
  return NextResponse.json({ datasets: getExportCatalog() }, { headers: { "cache-control": "no-store" } });
}

async function handlePOST(request: Request) {
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

export const GET = withApiAuth(handleGET, "admin");
export const POST = withApiAuth(handlePOST, "admin");
