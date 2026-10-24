import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/lib/database";

const schema = z.object({ description: z.string().trim().min(3), dueDate: z.string().datetime().optional() });
async function handlePOST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    return NextResponse.json(await database.tutoringAgreement.create({ data: {
      tutoringSessionId: id, description: input.description,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    }}), { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el acuerdo." }, { status: 400 }); }
}

export const POST = withApiAuth(handlePOST, "user");
