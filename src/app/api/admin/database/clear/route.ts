import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { clearDatabaseInputSchema } from "@/domain/database-admin";
import { clearManagedData } from "@/services/database-admin-service";

async function handlePOST(request: Request) {
  try {
    const input = clearDatabaseInputSchema.parse(await request.json());
    return NextResponse.json(await clearManagedData(input.scope, input.confirmation));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo borrar la información." }, { status: 400 });
  }
}

export const POST = withApiAuth(handlePOST, "admin");
