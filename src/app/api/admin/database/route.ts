import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { databaseTableKeySchema } from "@/domain/database-admin";
import { databaseDeletionScopes, getDatabaseOverview } from "@/services/database-admin-service";

export const dynamic = "force-dynamic";

async function handleGET(request: Request) {
  try {
    const requested = new URL(request.url).searchParams.get("table") ?? "students";
    const table = databaseTableKeySchema.parse(requested);
    return NextResponse.json({ ...(await getDatabaseOverview(table)), deletionScopes: databaseDeletionScopes }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo consultar la base de datos." }, { status: 400 });
  }
}

export const GET = withApiAuth(handleGET, "admin");
