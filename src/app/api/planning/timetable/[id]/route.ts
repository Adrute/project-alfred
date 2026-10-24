import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { deleteTimetableSlot } from "@/services/planning-service";

async function handleDELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await deleteTimetableSlot(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar la franja." }, { status: 400 });
  }
}

export const DELETE = withApiAuth(handleDELETE, "user");
