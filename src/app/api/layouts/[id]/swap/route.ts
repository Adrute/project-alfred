import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { z } from "zod";
import { swapAssignments } from "@/services/classroom-service";

const schema = z.object({ firstId: z.string().min(1), secondId: z.string().min(1) });
async function handlePOST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    return NextResponse.json(await swapAssignments(id, input.firstId, input.secondId));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron intercambiar los asientos." }, { status: 400 }); }
}

export const POST = withApiAuth(handlePOST, "user");
