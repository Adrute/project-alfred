import { NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/lib/database";

const schema = z.object({ content: z.string().trim().min(3), category: z.string().trim().min(2).optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; return NextResponse.json(await database.studentObservation.update({ where: { id }, data: schema.parse(await request.json()) })); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo editar." }, { status: 400 }); }
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; await database.studentObservation.delete({ where: { id } }); return NextResponse.json({ deleted: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar." }, { status: 400 }); }
}
