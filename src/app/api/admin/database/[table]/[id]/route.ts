import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { databaseTableKeySchema, deleteDatabaseRecordInputSchema } from "@/domain/database-admin";
import { removeManagedRecord } from "@/services/database-admin-service";

async function handleDELETE(request: Request, context: { params: Promise<{ table: string; id: string }> }) {
  try {
    const params = await context.params;
    const table = databaseTableKeySchema.parse(params.table);
    const { confirmation } = deleteDatabaseRecordInputSchema.parse(await request.json());
    return NextResponse.json(await removeManagedRecord(table, params.id, confirmation));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo borrar el registro." }, { status: 400 });
  }
}

export const DELETE = withApiAuth(handleDELETE, "admin");
