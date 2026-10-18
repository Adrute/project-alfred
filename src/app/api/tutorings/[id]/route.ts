import { NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/lib/database";

const schema = z.object({ preparation: z.string().optional(), notes: z.string().optional(), status: z.enum(["draft", "prepared", "completed"]).optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await database.tutoringSession.update({ where: { id }, data: schema.parse(await request.json()) }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar." }, { status: 400 }); }
}
