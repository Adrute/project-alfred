import { NextResponse } from "next/server";
import { confirmAction } from "@/services/action-service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await confirmAction(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo confirmar." }, { status: 400 });
  }
}
